import React, { useState, useEffect } from "react";
import { Avatar, Card, Grid } from "@mui/material";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import FadeIn from "components/Fade-in";
import { useMaterialUIController } from "context";

function MemberIterationMetrics() {
  const [loading, setLoading] = useState(true);
  const [memberMetrics, setMemberMetrics] = useState({});
  const [iterationsList, setIterationsList] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  const [controller] = useMaterialUIController();
  const { sidenavColor } = controller;

  useEffect(() => {
    async function fetchData() {
      // Read values from environment variables
      const group = process.env.REACT_APP_GITLAB_GROUP;
      const url = process.env.REACT_APP_GITLAB_URL;
      const token = process.env.REACT_APP_GITLAB_TOKEN;

      const query = `
        query {
          group(fullPath: "${group}") {
            groupMembers (first: 9) {
              nodes {
                user {
                  name
                  username
                  avatarUrl
                  publicEmail
                }
              }
            }
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
                timelogs(first: 100000) {
                  nodes {
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
            Authorization: token,
          },
          body: JSON.stringify({ query }),
        });
        const result = await response.json();
        const groupData = result.data.group;

        // Extract members
        const members = groupData.groupMembers.nodes.map((node) => node.user);
        setGroupMembers(members);

        // Process iterations.
        // For each iteration, use the title if available; otherwise, use its startDate as a fallback.
        const iterations = groupData.iterations.nodes.map((iter) => {
          const key = iter.title ? iter.title : iter.startDate;
          return {
            key,
            start: iter.startDate ? new Date(iter.startDate) : null,
            due: iter.dueDate ? new Date(iter.dueDate) : null,
          };
        });
        // Sort iterations by start date ascending.
        iterations.sort((a, b) => a.start - b.start);
        setIterationsList(iterations);

        // Initialize memberMetrics: for each member, create an object mapping each iteration key to 0 hours.
        const metrics = {};
        members.forEach((member) => {
          metrics[member.username] = {};
          iterations.forEach((iter) => {
            metrics[member.username][iter.key] = 0;
          });
        });

        // Process issues and timelogs.
        const issues = groupData.issues.nodes;
        issues.forEach((issue) => {
          if (issue.timelogs && issue.timelogs.nodes.length > 0) {
            issue.timelogs.nodes.forEach((log) => {
              const logDate = new Date(log.spentAt);
              // Determine which iteration(s) this timelog belongs to.
              iterations.forEach((iter) => {
                if (iter.start && iter.due && logDate >= iter.start && logDate <= iter.due) {
                  // Determine which member(s) get this logged time.
                  const assignees = issue.assignees.nodes;
                  if (assignees && assignees.length > 0) {
                    // Split logged time evenly among assignees.
                    const distributedTime = log.timeSpent / assignees.length;
                    assignees.forEach((a) => {
                      if (metrics[a.username] !== undefined) {
                        metrics[a.username][iter.key] += distributedTime;
                      }
                    });
                  } else {
                    // If no assignees, attribute to the log's user.
                    const username = log.user.username;
                    if (metrics[username] !== undefined) {
                      metrics[username][iter.key] += log.timeSpent;
                    }
                  }
                }
              });
            });
          }
        });

        // Convert seconds to hours and format as strings with two decimals.
        Object.keys(metrics).forEach((username) => {
          Object.keys(metrics[username]).forEach((iterKey) => {
            metrics[username][iterKey] = (metrics[username][iterKey] / 3600).toFixed(2);
          });
        });

        setMemberMetrics(metrics);
      } catch (error) {
        console.error("Error fetching member iteration metrics:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <DashboardLayout>
        <DashboardNavbar />
        <MDBox py={3} textAlign="center">
          <MDTypography variant="h6">Loading Member Iteration Metrics...</MDTypography>
        </MDBox>
        <Footer />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <Grid container spacing={3}>
          {groupMembers.map((member) => (
            <Grid item xs={6} sm={4} md={3} key={member.username}>
              <FadeIn duration={200}>
                <Card sx={{ height: "100%" }}>
                  <MDBox p={2}>
                    <MDBox
                      mx={2}
                      mt={-3}
                      py={1}
                      px={2}
                      variant="gradient"
                      bgColor={sidenavColor}
                      borderRadius="lg"
                      coloredShadow={sidenavColor}
                      display="flex"
                      alignItems="center"
                      justifyContent="space-between"
                    >
                      <Avatar src={member.avatarUrl} alt={member.name || member.username} />
                      <MDTypography variant="h6" color="white" ml={1}>
                        {member.name || member.username}
                      </MDTypography>
                    </MDBox>
                    {iterationsList
                      .filter((iter) => parseFloat(memberMetrics[member.username][iter.key]) > 0)
                      .map((iter) => (
                        <MDBox
                          key={iter.key}
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                          my={1}
                        >
                          <MDTypography variant="caption">{iter.key}</MDTypography>
                          <MDTypography variant="h6">
                            {memberMetrics[member.username][iter.key]} hrs
                          </MDTypography>
                        </MDBox>
                      ))}
                  </MDBox>
                </Card>
              </FadeIn>
            </Grid>
          ))}
        </Grid>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default MemberIterationMetrics;
