import React, { useState, useEffect } from "react";
import Grid from "@mui/material/Grid";
import MDBox from "components/MDBox";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import MDTypography from "components/MDTypography";
import VerticalBarChart from "examples/Charts/BarCharts/VerticalBarChart";
import { useMaterialUIController } from "context";

function Sprints() {
  const [loading, setLoading] = useState(true);
  const [sprintsChartData, setSprintsChartData] = useState(null);
  const [controller] = useMaterialUIController();
  const { sidenavColor } = controller;
  const url = process.env.REACT_APP_GITLAB_URL;
  const token = process.env.REACT_APP_GITLAB_TOKEN;
  const group = process.env.REACT_APP_GITLAB_GROUP;

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
                  dueDate
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
        const iterations = iterationsResult.data.group.iterations.nodes;

        // Now fetch all issues with pagination
        let allIssues = [];
        let hasNextPage = true;
        let after = null;
        while (hasNextPage) {
          const issuesQuery = `
            query($after: String) {
              group(fullPath: "${group}") {
                issues(includeSubgroups: true, first: 100, after: $after) {
                  nodes {
                    weight
                    timelogs(first: 100) {
                      nodes {
                        timeSpent
                      }
                    }
                    iteration {
                      id
                      title
                      startDate
                      dueDate
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

        // Delete iteration with id="gid://gitlab/Iteration/60" from the iterations array
        const filteredIterations = iterations.filter(
          (iter) => iter.id !== "gid://gitlab/Iteration/60"
        );

        // Build a dictionary keyed by iteration id.
        // Use iteration title if available; otherwise fallback to its startDate.
        const sprintData = {};
        filteredIterations.forEach((iteration) => {
          const label = iteration.title ? iteration.title : iteration.startDate;
          sprintData[iteration.id] = {
            label,
            totalWeights: 0,
            totalTimeSeconds: 0,
            startDate: iteration.startDate,
          };
        });

        // Process each issue that belongs to an iteration.
        allIssues.forEach((issue) => {
          if (issue.iteration && sprintData[issue.iteration.id]) {
            const weight = issue.weight || 0;
            sprintData[issue.iteration.id].totalWeights += weight;
            issue.timelogs.nodes.forEach((log) => {
              sprintData[issue.iteration.id].totalTimeSeconds += log.timeSpent;
            });
          }
        });

        // Prepare arrays for chart labels and datasets.
        // Optionally, sort by iteration startDate.
        const sortedSprints = Object.values(sprintData).sort(
          (a, b) => new Date(a.startDate) - new Date(b.startDate)
        );
        const labels = sortedSprints.map((sprint) => sprint.label);
        const totalWeightsArr = sortedSprints.map((sprint) => sprint.totalWeights);
        const totalLoggedHoursArr = sortedSprints.map((sprint) =>
          parseFloat((sprint.totalTimeSeconds / 3600).toFixed(2))
        );

        // Prepare the chart data with two datasets.
        const chartData = {
          labels,
          datasets: [
            {
              label: "Total Weights",
              data: totalWeightsArr,
              color: "dark",
            },
            {
              label: "Total Logged Hours",
              data: totalLoggedHoursArr,
              color: "error",
            },
          ],
        };

        setSprintsChartData(chartData);
      } catch (error) {
        console.error("Error fetching sprints data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading || !sprintsChartData) {
    return (
      <MDBox py={3} textAlign="center">
        <MDTypography variant="h6">Loading Sprints Data...</MDTypography>
      </MDBox>
    );
  }

  return (
    <MDBox py={3}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <VerticalBarChart
            icon={{ component: "timeline", color: sidenavColor }}
            title="Issue Weights vs Logged Hours"
            description="Total estimated (weights) vs. actual logged hours per sprint"
            chart={sprintsChartData}
          />
        </Grid>
      </Grid>
    </MDBox>
  );
}

export default Sprints;
