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

  // Compute node levels based on dependencies (edges).
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

  useEffect(() => {
    async function fetchData() {
      const query = `
        query {
          group(fullPath: "${group}") {
            issues(includeSubgroups: true) {
              nodes {
                id
                title
                blockedByIssues {
                  nodes {
                    id
                  }
                }
              }
            }
          }
        }
      `;
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: token,
          },
          body: JSON.stringify({ query }),
        });
        const result = await response.json();
        const issues = result.data.group.issues.nodes;

        // Create nodes: each issue becomes a node.
        const nodes = issues.map((issue) => {
          // Create a safe ID by extracting only the numeric part.
          const safeId = issue.id
            .split("/")
            .pop()
            .replace(/[^0-9]/g, "");
          return {
            id: safeId,
            label: issue.title ? issue.title.trim() : "No Title",
          };
        });

        // Create links: for each issue, for each dependency (blockedByIssues),
        // create a directed link from the dependency to the current issue.
        const links = [];
        issues.forEach((issue) => {
          const safeTargetId = issue.id
            .split("/")
            .pop()
            .replace(/[^0-9]/g, "");
          if (issue.blockedByIssues && issue.blockedByIssues.nodes.length > 0) {
            issue.blockedByIssues.nodes.forEach((dep) => {
              const safeSourceId = dep.id
                .split("/")
                .pop()
                .replace(/[^0-9]/g, "");
              links.push({
                source: safeSourceId,
                target: safeTargetId,
              });
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

        // Compute levels using our helper.
        const nodesWithLevels = computeLevels(filteredNodes, links);
        // Find maximum level.
        const maxLevel = Math.max(...nodesWithLevels.map((n) => n.level));
        // Group nodes by level.
        const levelGroups = {};
        nodesWithLevels.forEach((node) => {
          if (!levelGroups[node.level]) levelGroups[node.level] = [];
          levelGroups[node.level].push(node);
        });
        // Assign positions: x based on level, y evenly distributed per level.
        Object.keys(levelGroups).forEach((levelStr) => {
          const level = parseInt(levelStr, 10);
          const groupNodes = levelGroups[level];
          // x position: equally divide available width by (maxLevel+1)
          const x = (level / (maxLevel + 1)) * graphConfig.width + 50; // add margin if desired
          const spacing = graphConfig.height / (groupNodes.length + 1);
          groupNodes.forEach((node, idx) => {
            node.x = x;
            node.y = (idx + 1) * spacing;
          });
        });

        setGraphData({ nodes: nodesWithLevels, links });
      } catch (error) {
        console.error("Error fetching dependency graph data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [group, token, url]);

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
        <Graph id="issues-dependency-graph" data={graphData} config={graphConfig} />
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default IssuesDependencyGraph;
