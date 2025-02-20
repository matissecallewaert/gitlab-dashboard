import React, { useState, useEffect } from "react";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import { Network, Node, Edge } from "react-vis-network";
import PropTypes from "prop-types";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";

// Helper to compute contrasting text color based on a hex background.
function getContrastingColor(hex) {
  const hexVal = hex.replace(/^#/, "");
  const r = parseInt(hexVal.substring(0, 2), 16);
  const g = parseInt(hexVal.substring(2, 4), 16);
  const b = parseInt(hexVal.substring(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? "black" : "white";
}

// Global mapping for project colors.
const projectColorMap = {};
function getProjectColor(project) {
  if (!projectColorMap[project]) {
    projectColorMap[project] = "#" + Math.floor(Math.random() * 16777215).toString(16);
  }
  return projectColorMap[project];
}

// Custom node component that returns a proper SVG element.
const CustomNode = (props) => {
  const { title, labels, project } = props;
  const borderColor = getProjectColor(project);
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="150" height="80">
      <rect width="150" height="80" rx="5" fill="white" stroke={borderColor} strokeWidth="8" />
      <foreignObject x="0" y="0" width="150" height="80">
        <div
          xmlns="http://www.w3.org/1999/xhtml"
          style={{
            fontSize: "10px",
            color: "black",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            height: "100%",
            overflow: "hidden",
            wordWrap: "break-word",
            padding: "0 5px",
          }}
        >
          <div style={{ marginBottom: "4px", fontWeight: "bold" }}>{title}</div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "4px",
            }}
          >
            {labels && labels.length > 0
              ? labels.map((label) => (
                  <span
                    key={label.title}
                    style={{
                      backgroundColor: label.color,
                      color: getContrastingColor(label.color),
                      padding: "2px 6px",
                      borderRadius: "12px",
                      fontSize: "8px",
                    }}
                  >
                    {label.title}
                  </span>
                ))
              : null}
          </div>
        </div>
      </foreignObject>
    </svg>
  );
};

CustomNode.defaultProps = {
  title: "No Title",
  labels: [],
  project: "Default Project",
};

CustomNode.propTypes = {
  title: PropTypes.string,
  labels: PropTypes.array,
  project: PropTypes.string,
};

function IssuesDependencyGraph() {
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [issues, setIssues] = useState([]);
  const [iterations, setIterations] = useState([]);
  const [projects, setProjects] = useState([]); // New state for projects
  const [selectedIteration, setSelectedIteration] = useState("all");
  const [networkInstance, setNetworkInstance] = useState(null);

  const url = process.env.REACT_APP_GITLAB_URL;
  const token = process.env.REACT_APP_GITLAB_TOKEN;
  const group = process.env.REACT_APP_GITLAB_GROUP;

  // Modified vis-network options for a left-to-right hierarchical layout.
  const visOptions = {
    layout: {
      hierarchical: {
        enabled: true,
        direction: "LR",
        sortMethod: "directed",
        nodeSpacing: 150,
        levelSeparation: 200,
        treeSpacing: 10,
        blockShifting: true,
        edgeMinimization: false,
        parentCentralization: false,
      },
    },
    physics: {
      enabled: true,
    },
    interaction: {
      hover: true,
      zoomView: true,
      dragView: true,
    },
  };

  // Fetch iterations and issues.
  useEffect(() => {
    async function fetchData() {
      try {
        const iterationsQuery = `
          query {
            group(fullPath: "${group}") {
              iterations {
                nodes {
                  id
                  title
                  startDate
                }
              }
            }
          }
        `;
        const iterationsResponse = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: token,
          },
          body: JSON.stringify({ query: iterationsQuery }),
        });
        const iterationsResult = await iterationsResponse.json();
        if (!iterationsResult.data) {
          console.error("Iterations query error:", iterationsResult.errors);
          throw new Error("Iterations query error");
        }
        const fetchedIterations = iterationsResult.data.group.iterations.nodes;
        setIterations(fetchedIterations);

        let allIssues = [];
        let hasNextPage = true;
        let after = null;
        while (hasNextPage) {
          const issuesQuery = `
            query($after: String) {
              group(fullPath: "${group}") {
                issues(includeSubgroups: true, first: 100, after: $after, state: opened) {
                  nodes {
                    id
                    title
                    closedAt
                    iteration {
                      id
                      startDate
                    }
                    blockedByIssues {
                      nodes {
                        id
                        closedAt
                      }
                    }
                    description
                    labels {
                      nodes {
                        ... on Label {
                          title
                          color
                        }
                      }
                    }
                    projectId
                  }
                  pageInfo {
                    endCursor
                    hasNextPage
                  }
                }
              }
            }
          `;
          const issuesResponse = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: token,
            },
            body: JSON.stringify({
              query: issuesQuery,
              variables: { after },
            }),
          });
          const issuesResult = await issuesResponse.json();
          if (!issuesResult.data) {
            console.error("Issues query error:", issuesResult.errors);
            throw new Error("Issues query error");
          }
          const issuesData = issuesResult.data.group.issues;
          allIssues = allIssues.concat(issuesData.nodes);
          hasNextPage = issuesData.pageInfo.hasNextPage;
          after = issuesData.pageInfo.endCursor;
        }
        const openIssues = allIssues.filter((issue) => !issue.closedAt);
        setIssues(openIssues);
      } catch (error) {
        console.error("Error fetching dependency graph data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [group, token, url]);

  // Fetch projects separately.
  useEffect(() => {
    async function fetchProjects() {
      try {
        const projectsQuery = `
          query {
            group(fullPath: "${group}") {
              projects(includeSubgroups: true) {
                nodes {
                  id
                  name
                }
              }
            }
          }
        `;
        const projectsResponse = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: token,
          },
          body: JSON.stringify({ query: projectsQuery }),
        });
        const projectsResult = await projectsResponse.json();
        if (!projectsResult.data) {
          console.error("Projects query error:", projectsResult.errors);
          throw new Error("Projects query error");
        }

        const projectsSplit = projectsResult.data.group.projects.nodes.map((project) => {
          const splitId = project.id.split("/").pop();
          return { ...project, id: splitId };
        });

        // Create a set of active project IDs from the issues currently displayed.
        const activeProjectIds = new Set(
          issues.map((issue) => (issue.projectId ? issue.projectId.toString() : "Default Project"))
        );
        // Filter out projects that have no issues on the canvas.
        const fetchedProjects = projectsSplit.filter((project) =>
          activeProjectIds.has(project.id.toString())
        );
        setProjects(fetchedProjects);
      } catch (error) {
        console.error("Error fetching projects:", error);
      }
    }
    fetchProjects();
  }, [group, token, url, issues]);

  // Convert issues to nodes and edges.
  useEffect(() => {
    let filteredIssues = issues;
    if (selectedIteration !== "all") {
      filteredIssues = issues.filter(
        (issue) => issue.iteration && issue.iteration.startDate === selectedIteration
      );
    }

    const builtNodes = filteredIssues.map((issue) => {
      const safeId = issue.id
        .split("/")
        .pop()
        .replace(/[^0-9]/g, "");
      const title = issue.title ? issue.title.trim() : "No Title";
      const labelArray =
        issue.labels && issue.labels.nodes
          ? issue.labels.nodes.map((l) => ({
              title: l.title,
              color: l.color,
              project: issue.projectId,
            }))
          : [];
      const project = issue.projectId ? issue.projectId.toString() : "Default Project";

      return {
        id: safeId,
        component: CustomNode,
        title,
        description: issue.description || "No Description",
        labels: labelArray,
        project,
      };
    });

    const builtEdges = [];
    const issueIdSet = new Set(filteredIssues.map((issue) => issue.id));
    filteredIssues.forEach((issue) => {
      const targetSafeId = issue.id
        .split("/")
        .pop()
        .replace(/[^0-9]/g, "");
      if (issue.blockedByIssues && issue.blockedByIssues.nodes.length > 0) {
        issue.blockedByIssues.nodes.forEach((dep) => {
          if (!dep.closedAt && issueIdSet.has(dep.id)) {
            const sourceSafeId = dep.id
              .split("/")
              .pop()
              .replace(/[^0-9]/g, "");
            builtEdges.push({
              id: `${sourceSafeId}-${targetSafeId}`,
              from: sourceSafeId,
              to: targetSafeId,
              arrows: "to",
            });
          }
        });
      }
    });

    const connectedIds = new Set();
    builtEdges.forEach((edge) => {
      connectedIds.add(edge.from);
      connectedIds.add(edge.to);
    });
    const filteredNodes = builtNodes.filter((node) => connectedIds.has(node.id));

    setNodes(filteredNodes);
    setEdges(builtEdges);
  }, [issues, selectedIteration]);

  useEffect(() => {
    if (networkInstance && nodes.length > 0) {
      networkInstance.fit();
    }
  }, [networkInstance, nodes]);

  const handleIterationChange = (event) => {
    setSelectedIteration(event.target.value);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <DashboardNavbar />
        <MDBox py={3} textAlign="center">
          <MDTypography variant="h6">Loading Issues Dependency Graph...</MDTypography>
        </MDBox>
        <Footer />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3} px={3}>
        <MDBox mb={3} display="flex" alignItems="center" justifyContent="space-between">
          {/* Iteration Selector on the Left */}
          <MDBox display="flex" alignItems="center">
            <FormControl>
              <InputLabel id="iteration-select-label">Select Iteration</InputLabel>
              <Select
                labelId="iteration-select-label"
                value={selectedIteration}
                onChange={handleIterationChange}
                label="Select Iteration"
                sx={{ padding: 1 }}
              >
                <MenuItem value="all">All Iterations</MenuItem>
                {iterations.map((iter) => (
                  <MenuItem key={`${iter.startDate}-${iter.id}`} value={iter.startDate}>
                    {iter.title ? iter.title : iter.startDate}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </MDBox>
          {/* Projects Legend on the Right */}
          <MDBox ml={3}>
            <MDTypography variant="h6">Projects Legend:</MDTypography>
            <div style={{ display: "flex", flexWrap: "wrap" }}>
              {projects.map((project) => (
                <div
                  key={project.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginRight: "16px",
                    marginBottom: "8px",
                  }}
                >
                  <div
                    style={{
                      width: "20px",
                      height: "20px",
                      backgroundColor: getProjectColor(project.id),
                      marginRight: "8px",
                      border: "1px solid black",
                    }}
                  />
                  <MDTypography variant="button">{project.name}</MDTypography>
                </div>
              ))}
            </div>
          </MDBox>
        </MDBox>
        <div
          style={{
            height: window.innerHeight * 0.8,
            width: window.innerWidth * 0.8,
            overflow: "hidden",
            position: "relative",
          }}
        >
          <Network options={visOptions} getNetwork={(net) => setNetworkInstance(net)}>
            {nodes.map((node) => (
              <Node
                key={node.id}
                id={node.id}
                component={node.component}
                title={node.title}
                description={node.description}
                labels={node.labels}
                project={node.project}
              />
            ))}
            {edges.map((edge) => (
              <Edge key={edge.id} id={edge.id} from={edge.from} to={edge.to} arrows={edge.arrows} />
            ))}
          </Network>
        </div>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default IssuesDependencyGraph;
