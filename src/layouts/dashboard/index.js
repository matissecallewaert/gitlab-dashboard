import React, { useState, useEffect } from "react";
import Grid from "@mui/material/Grid";
import MDBox from "components/MDBox";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import ComplexStatisticsCard from "examples/Cards/StatisticsCards/ComplexStatisticsCard";
import FadeIn from "components/Fade-in";
import { useMaterialUIController } from "context";
import VerticalBarChart from "examples/Charts/BarCharts/VerticalBarChart";
import MDTypography from "components/MDTypography";
import SprintCycleTime from "./components/SprintCycleTime";

function Dashboard() {
  const [controller] = useMaterialUIController();
  const { sidenavColor } = controller;
  const group = process.env.REACT_APP_GITLAB_GROUP;
  const url = process.env.REACT_APP_GITLAB_URL;
  const token = process.env.REACT_APP_GITLAB_TOKEN;

  // State to hold GitLab statistics and chart data
  const [gitlabStats, setGitlabStats] = useState({
    totalHours: 0,
    issuesLogged: 0,
    totalIssues: 0,
    iterationData: {
      labels: [],
      datasets: [
        {
          label: "Logged Hours",
          data: [],
        },
      ],
    },
    memberHoursChartData: {
      labels: [],
      datasets: [
        {
          label: "Hours per Member",
          data: [],
          color: "info",
        },
      ],
    },
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGitlabData = async () => {
      // Query now fetches iterations (sprints) along with issues (including timelogs and assignees)
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
            issues(includeSubgroups: true) {
              nodes {
                title
                iid
                timelogs(first: 100000) {
                  nodes {
                    summary
                    timeSpent
                    spentAt
                    user {
                      username
                    }
                  }
                }
                assignees {
                  nodes {
                    username
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
            // Replace with your actual GitLab private token
            Authorization: token,
          },
          body: JSON.stringify({ query }),
        });

        const result = await response.json();
        const iterations = result.data.group.iterations.nodes;
        const issues = result.data.group.issues.nodes;

        let totalSeconds = 0;
        let loggedIssuesCount = 0;
        let totalIssues = issues.length;
        const memberHours = {};

        // Build an object keyed by iteration (sprint) using its title (or fallback to startDate)
        const iterationSummary = {};
        iterations.forEach((iteration) => {
          const fallbackKey = iteration.startDate;
          const key = iteration.title ? iteration.title : fallbackKey;
          const start = iteration.startDate ? new Date(iteration.startDate) : null;
          const due = iteration.dueDate ? new Date(iteration.dueDate) : null;
          iterationSummary[key] = {
            title: key,
            start,
            due,
            totalTime: 0, // in seconds
          };
        });

        // Process each issue's timelogs
        issues.forEach((issue) => {
          if (issue.timelogs && issue.timelogs.nodes.length > 0) {
            loggedIssuesCount += 1;
          }
          issue.timelogs.nodes.forEach((log) => {
            totalSeconds += log.timeSpent;

            const spentAt = new Date(log.spentAt);
            // Assign this timelog to an iteration if it falls within the iteration's date range
            Object.values(iterationSummary).forEach((iter) => {
              if (iter.start && iter.due && spentAt >= iter.start && spentAt <= iter.due) {
                iter.totalTime += log.timeSpent;
              }
            });

            // Distribute logged time per member (splitting evenly if multiple assignees)
            const assignees = issue.assignees.nodes;
            if (assignees && assignees.length > 0) {
              if (assignees.length > 1) {
                const distributedTime = log.timeSpent / assignees.length;
                assignees.forEach((a) => {
                  memberHours[a.username] = (memberHours[a.username] || 0) + distributedTime;
                });
              } else {
                const username = assignees[0].username;
                memberHours[username] = (memberHours[username] || 0) + log.timeSpent;
              }
            } else {
              const username = log.user.username;
              memberHours[username] = (memberHours[username] || 0) + log.timeSpent;
            }
          });
        });

        const totalHours = (totalSeconds / 3600).toFixed(2);

        // Build iteration data arrays only for iterations with logged hours
        const filteredIterations = Object.values(iterationSummary).filter(
          (iter) => iter.totalTime > 0
        );
        const iterationLabels = filteredIterations.map((iter) => iter.title);
        const iterationData = filteredIterations.map((iter) => (iter.totalTime / 3600).toFixed(2));

        // Build member hours chart data
        const memberLabels = Object.keys(memberHours).sort(
          (a, b) => memberHours[b] - memberHours[a]
        );
        const memberData = memberLabels.map((username) =>
          (memberHours[username] / 3600).toFixed(2)
        );

        setGitlabStats({
          totalHours,
          issuesLogged: loggedIssuesCount,
          totalIssues,
          iterationData: {
            labels: iterationLabels,
            datasets: [
              {
                label: "Logged Hours",
                data: iterationData,
              },
            ],
          },
          memberHoursChartData: {
            labels: memberLabels,
            datasets: [
              {
                label: "Hours per Member",
                data: memberData,
              },
            ],
          },
        });
      } catch (error) {
        console.error("Error fetching GitLab data", error);
      }
      setLoading(false);
    };

    fetchGitlabData();
  }, []);

  if (loading) {
    return (
      <DashboardLayout>
        <DashboardNavbar />
        <MDBox py={3} textAlign="center">
          <MDTypography variant="h6">Loading data from GitLab...</MDTypography>
        </MDBox>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <Grid container spacing={3}>
          {/* Statistics Cards */}
          <Grid item xs={12}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={4}>
                <FadeIn duration={200}>
                  <MDBox>
                    <ComplexStatisticsCard
                      color={sidenavColor}
                      icon="access_time"
                      title="Hours Worked"
                      count={gitlabStats.totalHours}
                      description="Total hours logged in GitLab"
                    />
                  </MDBox>
                </FadeIn>
              </Grid>
              <Grid item xs={12} sm={4}>
                <FadeIn duration={200}>
                  <MDBox>
                    <ComplexStatisticsCard
                      color={sidenavColor}
                      icon="confirmation_number"
                      title="Total Issues"
                      count={gitlabStats.totalIssues}
                      description="Total issues in the project"
                    />
                  </MDBox>
                </FadeIn>
              </Grid>
              <Grid item xs={12} sm={4}>
                <FadeIn duration={200}>
                  <MDBox>
                    <ComplexStatisticsCard
                      color={sidenavColor}
                      icon="assignment"
                      title="Issues Logged"
                      count={gitlabStats.issuesLogged}
                      description="Issues with logged hours"
                    />
                  </MDBox>
                </FadeIn>
              </Grid>
            </Grid>
          </Grid>

          {/* Charts */}
          <Grid item xs={12}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FadeIn duration={300}>
                  <VerticalBarChart
                    icon={{ component: "today", color: "dark" }}
                    title="Iteration Logged Hours"
                    description="Logged hours per sprint (iteration)"
                    height="19.125rem"
                    chart={gitlabStats.iterationData}
                    color={sidenavColor}
                  />
                </FadeIn>
              </Grid>
              <Grid item xs={12} md={6}>
                <FadeIn duration={300}>
                  <VerticalBarChart
                    icon={{ component: "person", color: "dark" }}
                    title="Member Hours"
                    description="Hours worked by each member"
                    height="19.125rem"
                    chart={gitlabStats.memberHoursChartData}
                    color={sidenavColor}
                  />
                </FadeIn>
              </Grid>
            </Grid>
          </Grid>

          {/* Sprint Cycle Time: half width */}
          <Grid item xs={12} mt={3}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FadeIn duration={300}>
                  <SprintCycleTime />
                </FadeIn>
              </Grid>
              {/* Additional content could go here */}
              <Grid item xs={12} md={6}></Grid>
            </Grid>
          </Grid>
        </Grid>
      </MDBox>
      <FadeIn duration={200}>
        <Footer />
      </FadeIn>
    </DashboardLayout>
  );
}

export default Dashboard;
