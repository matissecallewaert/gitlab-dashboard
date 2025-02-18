import React, { useState, useEffect } from "react";
import Grid from "@mui/material/Grid";
import MDBox from "components/MDBox";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import MDTypography from "components/MDTypography";
import ReportsLineChart from "examples/Charts/LineCharts/ReportsLineChart";
import FadeIn from "components/Fade-in";
import MergeRequestMetrics from "layouts/dashboard/components/MergeRequestMetrics";
import { useMaterialUIController } from "context";

function Merges() {
  const [loading, setLoading] = useState(true);
  const [commentsChartData, setCommentsChartData] = useState(null);
  const [pipelineChartData, setPipelineChartData] = useState(null);
  const [mergeDurationChartData, setMergeDurationChartData] = useState(null);
  const [controller] = useMaterialUIController();
  const { sidenavColor } = controller;
  const group = process.env.REACT_APP_GITLAB_GROUP;
  const url = process.env.REACT_APP_GITLAB_URL;
  const token = process.env.REACT_APP_GITLAB_TOKEN;

  useEffect(() => {
    async function fetchData() {
      // Query now fetches iterations with startDate and dueDate, plus merge requests with createdAt, mergedAt, notes, and pipelines.
      const query = `
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
            mergeRequests(includeSubgroups: true, first: 100) {
              nodes {
                createdAt
                mergedAt
                notes(first: 100) {
                  nodes {
                    id
                  }
                }
                pipelines(first: 100) {
                  nodes {
                    status
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

        // Extract iterations and merge requests.
        const iterations = result.data.group.iterations.nodes;
        const mergeRequests = result.data.group.mergeRequests.nodes;

        // Build an object keyed by iteration title.
        // If title is null, use the iteration startDate as fallback.
        const sprintStats = {};
        iterations.forEach((iteration) => {
          const fallbackKey = iteration.startDate;
          const key = iteration.title ? iteration.title : fallbackKey;
          const start = iteration.startDate ? new Date(iteration.startDate) : null;
          const due = iteration.dueDate ? new Date(iteration.dueDate) : null;
          sprintStats[key] = {
            title: key,
            start,
            due,
            totalComments: 0,
            totalPipelineFailures: 0,
            totalMergeDuration: 0, // total merge duration in hours
            mergedCount: 0, // count of merged MRs
            count: 0,
          };
        });

        // For each merge request, assign it to an iteration based on its createdAt date.
        mergeRequests.forEach((mr) => {
          const mrDate = new Date(mr.createdAt);
          // Find an iteration where mrDate falls between its start and due dates.
          for (const key in sprintStats) {
            const sprint = sprintStats[key];
            if (sprint.start && sprint.due && mrDate >= sprint.start && mrDate <= sprint.due) {
              sprint.count += 1;
              // Count comments from MR notes.
              const commentsCount = mr.notes.nodes.length;
              sprint.totalComments += commentsCount;
              // Count failed pipelines (status equals "FAILED").
              const failures = mr.pipelines.nodes.filter((p) => p.status === "FAILED").length;
              sprint.totalPipelineFailures += failures;
              // Calculate merge duration if mergedAt exists.
              if (mr.mergedAt) {
                const created = new Date(mr.createdAt);
                const merged = new Date(mr.mergedAt);
                const duration = (merged - created) / (1000 * 60 * 60); // in hours
                sprint.totalMergeDuration += duration;
                sprint.mergedCount += 1;
              }
              break; // Assume each MR falls into at most one sprint.
            }
          }
        });

        // Build arrays for chart labels and metrics.
        const labels = [];
        const avgComments = [];
        const avgPipelineFailures = [];
        const durationLabels = [];
        const avgMergeDuration = [];

        Object.values(sprintStats).forEach((stats) => {
          if (stats.count > 0) {
            labels.push(stats.title);
            avgComments.push(parseFloat((stats.totalComments / stats.count).toFixed(2)));
            avgPipelineFailures.push(
              parseFloat((stats.totalPipelineFailures / stats.count).toFixed(2))
            );
          }
          if (stats.mergedCount > 0) {
            durationLabels.push(stats.title);
            avgMergeDuration.push(
              parseFloat((stats.totalMergeDuration / stats.mergedCount).toFixed(2))
            );
          }
        });

        // Build chart objects for the ReportsLineChart.
        const commentsChart = {
          labels: labels,
          datasets: {
            label: "Avg Comments per MR",
            data: avgComments,
          },
        };

        const pipelineChart = {
          labels: labels,
          datasets: {
            label: "Avg Pipeline Failures per MR",
            data: avgPipelineFailures,
          },
        };

        const mergeDurationChart = {
          labels: durationLabels,
          datasets: {
            label: "Avg Merge Duration (hours)",
            data: avgMergeDuration,
          },
        };

        setCommentsChartData(commentsChart);
        setPipelineChartData(pipelineChart);
        setMergeDurationChartData(mergeDurationChart);
      } catch (error) {
        console.error("Error fetching merge request iteration metrics:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading || !commentsChartData || !pipelineChartData || !mergeDurationChartData) {
    return (
      <DashboardLayout>
        <DashboardNavbar />
        <MDBox py={3} textAlign="center">
          <MDTypography variant="h6">Loading Merge Request Iteration Metrics...</MDTypography>
        </MDBox>
        <Footer />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <Grid container spacing={3} mt={2}>
          {/* Chart for average comments per merge request */}
          <Grid item xs={12} md={4}>
            <FadeIn duration={200}>
              <ReportsLineChart
                color={sidenavColor}
                icon="chat"
                title="Avg Comments per MR"
                description="Average number of comments per merge request per sprint"
                date="Just updated"
                chart={commentsChartData}
              />
            </FadeIn>
          </Grid>
          {/* Chart for average pipeline failures per merge request */}
          <Grid item xs={12} md={4}>
            <FadeIn duration={200}>
              <ReportsLineChart
                color={sidenavColor}
                icon="error"
                title="Avg Pipeline Failures per MR"
                description="Average number of failed pipelines per merge request per sprint"
                date="Just updated"
                chart={pipelineChartData}
              />
            </FadeIn>
          </Grid>
          {/* Chart for average merge duration per merge request */}
          <Grid item xs={12} md={4}>
            <FadeIn duration={200}>
              <ReportsLineChart
                color={sidenavColor}
                icon="access_time"
                title="Avg Merge Duration per MR"
                description="Average duration a merge request stays open before being merged per sprint"
                date="Just updated"
                chart={mergeDurationChartData}
              />
            </FadeIn>
          </Grid>
          {/* Merge Request Metrics: full width */}
          <Grid item xs={12} mt={5}>
            <FadeIn duration={300}>
              <MergeRequestMetrics />
            </FadeIn>
          </Grid>
        </Grid>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default Merges;
