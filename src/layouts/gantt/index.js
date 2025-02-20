import React, { useState, useEffect } from "react";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import { Graph } from "react-d3-graph";

function IssuesDependencyGraph() {
  const [loading, setLoading] = useState(true);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [issues, setIssues] = useState([]);
  const [iterations, setIterations] = useState([]);
  const [selectedIteration, setSelectedIteration] = useState("all");

  const url = process.env.REACT_APP_GITLAB_URL;
  const token = process.env.REACT_APP_GITLAB_TOKEN;
  const group = process.env.REACT_APP_GITLAB_GROUP;

  // Graph configuration
  const graphConfig = {
    nodeHighlightBehavior: true,
    node: {
      color: "black",
      size: 400,
      highlightStrokeColor: "blue",
      labelProperty: "label",
      fontSize: 12,
      highlightFontSize: 16,
    },
    link: {
      highlightColor: "blue",
    },
    directed: true,
    height: window.innerHeight * 0.8,
    width: window.innerWidth * 0.8,
    staticGraph: true,
  };

  // Helper to compute node levels and assign positions.
  const computeLevels = (nodes, links) => {
    const nodeMap = {};
    nodes.forEach((node) => {
      nodeMap[node.id] = { ...node, indegree: 0, level: 0 };
    });
    // Calculate indegree for each node
    links.forEach((link) => {
      if (nodeMap[link.target]) {
        nodeMap[link.target].indegree++;
      }
    });
    // Initialize queue with nodes that have indegree 0
    const queue = [];
    Object.values(nodeMap).forEach((node) => {
      if (node.indegree === 0) queue.push(node);
    });
    while (queue.length > 0) {
      const curr = queue.shift();
      links.forEach((link) => {
        if (link.source === curr.id && nodeMap[link.target]) {
          const candidateLevel = curr.level + 1;
          if (candidateLevel > nodeMap[link.target].level) {
            nodeMap[link.target].level = candidateLevel;
          }
          nodeMap[link.target].indegree--;
          if (nodeMap[link.target].indegree === 0) {
            queue.push(nodeMap[link.target]);
          }
        }
      });
    }
    return Object.values(nodeMap);
  };

  // Fetch iterations and issues using pagination.
  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch iterations (for the dropdown) including startDate.
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
        const fetchedIterations = iterationsResult.data.group.iterations.nodes;
        // Delete iteration with id="gid://gitlab/Iteration/60"
        const filteredIterations = fetchedIterations.filter(
          (iter) => iter.id !== "gid://gitlab/Iteration/60"
        );
        setIterations(filteredIterations);

        // Now fetch all issues with pagination.
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
          const issuesData = issuesResult.data.group.issues;
          allIssues = allIssues.concat(issuesData.nodes);
          hasNextPage = issuesData.pageInfo.hasNextPage;
          after = issuesData.pageInfo.endCursor;
        }
        // Filter out any issues that might have a closedAt value.
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

  // Recompute graph data when issues or the selected iteration change.
  useEffect(() => {
    // If an iteration is selected (other than "all"), filter issues by matching iteration.startDate.
    let filteredIssues = issues;
    if (selectedIteration !== "all") {
      filteredIssues = issues.filter(
        (issue) => issue.iteration && issue.iteration.startDate === selectedIteration
      );
    }

    // Create nodes: each issue becomes a node.
    const nodes = filteredIssues.map((issue) => {
      const safeId = issue.id
        .split("/")
        .pop()
        .replace(/[^0-9]/g, "");
      return {
        id: safeId,
        label: issue.title ? issue.title.trim() : "No Title",
      };
    });

    // Create links: for each issue, add a directed link from each dependency (if open)
    // to the issue—but only if that dependency is also in our filtered issues.
    const issueIdSet = new Set(filteredIssues.map((issue) => issue.id));
    const links = [];
    filteredIssues.forEach((issue) => {
      const targetSafeId = issue.id
        .split("/")
        .pop()
        .replace(/[^0-9]/g, "");
      if (issue.blockedByIssues && issue.blockedByIssues.nodes.length > 0) {
        issue.blockedByIssues.nodes.forEach((dep) => {
          // Only include this dependency if it is open and part of the filtered issues.
          if (!dep.closedAt && issueIdSet.has(dep.id)) {
            const sourceSafeId = dep.id
              .split("/")
              .pop()
              .replace(/[^0-9]/g, "");
            links.push({
              source: sourceSafeId,
              target: targetSafeId,
            });
          }
        });
      }
    });

    // Filter nodes: keep only nodes that appear in at least one link.
    const linkedIds = new Set();
    links.forEach((link) => {
      linkedIds.add(link.source);
      linkedIds.add(link.target);
    });
    const filteredNodes = nodes.filter((node) => linkedIds.has(node.id));

    // Compute levels for the nodes and assign x/y positions.
    const nodesWithLevels = computeLevels(filteredNodes, links);
    const maxLevel = Math.max(...nodesWithLevels.map((n) => n.level));
    const levelGroups = {};
    nodesWithLevels.forEach((node) => {
      if (!levelGroups[node.level]) levelGroups[node.level] = [];
      levelGroups[node.level].push(node);
    });
    Object.keys(levelGroups).forEach((levelStr) => {
      const level = parseInt(levelStr, 10);
      const groupNodes = levelGroups[level];
      // Set x based on level and y evenly distributed.
      const x = (level / (maxLevel + 1)) * graphConfig.width + 50;
      const spacing = graphConfig.height / (groupNodes.length + 1);
      groupNodes.forEach((node, idx) => {
        node.x = x;
        node.y = (idx + 1) * spacing;
      });
    });

    setGraphData({ nodes: nodesWithLevels, links });
  }, [issues, selectedIteration, graphConfig.width, graphConfig.height]);

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
        {/* Iteration selection dropdown */}
        <MDBox mb={3}>
          <MDTypography variant="h6" mb={1}>
            Select Iteration:
          </MDTypography>
          <select value={selectedIteration} onChange={handleIterationChange}>
            <option value="all">All Iterations</option>
            {iterations.map((iter) => (
              <option key={iter.startDate} value={iter.startDate}>
                {iter.title ? iter.title : iter.startDate}
              </option>
            ))}
          </select>
        </MDBox>
        <Graph id="issues-dependency-graph" data={graphData} config={graphConfig} />
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default IssuesDependencyGraph;
