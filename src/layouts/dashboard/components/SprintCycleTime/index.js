import React, { useState, useEffect } from "react";
import Card from "@mui/material/Card";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import DataTable from "examples/Employees/DataTable";
import { useMaterialUIController } from "context";

function SprintCycleTime() {
  const [tableData, setTableData] = useState({ columns: [], rows: [] });
  const [loading, setLoading] = useState(true);
  const [controller] = useMaterialUIController();
  const { sidenavColor } = controller;
  const group = process.env.REACT_APP_GITLAB_GROUP;
  const url = process.env.REACT_APP_GITLAB_URL;
  const token = process.env.REACT_APP_GITLAB_TOKEN;

  useEffect(() => {
    async function fetchData() {
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
              createdAt
              closedAt
              iteration {
                id
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
        const iterations = result.data.group.iterations.nodes;
        const issues = result.data.group.issues.nodes;

        // Process each iteration and filter out ones without valid issue metrics.
        const rows = iterations
          .map((iteration) => {
            const iterationStart = new Date(iteration.startDate);
            let totalLeadTime = 0;
            let totalCycleTime = 0;
            let count = 0;

            // Filter issues belonging to this iteration
            const iterationIssues = issues.filter(
              (issue) => issue.iteration && issue.iteration.id === iteration.id
            );

            iterationIssues.forEach((issue) => {
              if (issue.createdAt && issue.closedAt) {
                const created = new Date(issue.createdAt);
                const closed = new Date(issue.closedAt);
                const leadTime = (closed - created) / (1000 * 60 * 60); // in hours
                const effectiveStart = created > iterationStart ? created : iterationStart;
                const cycleTime = (closed - effectiveStart) / (1000 * 60 * 60);
                totalLeadTime += leadTime;
                totalCycleTime += cycleTime;
                count++;
              }
            });
            if (count === 0) return null; // Skip iteration if no valid issues

            const avgLeadTime = (totalLeadTime / count).toFixed(2);
            const avgCycleTime = (totalCycleTime / count).toFixed(2);
            return {
              sprint: iteration.startDate,
              avgLeadTime,
              avgCycleTime,
              issuesCount: count,
            };
          })
          .filter((row) => row !== null);

        const columns = [
          { Header: "Sprint", accessor: "sprint", align: "left" },
          { Header: "Avg Lead Time (hours)", accessor: "avgLeadTime", align: "right" },
          { Header: "Avg Cycle Time (hours)", accessor: "avgCycleTime", align: "right" },
          { Header: "Issues Count", accessor: "issuesCount", align: "right" },
        ];

        setTableData({ columns, rows });
      } catch (error) {
        console.error("Error fetching sprint data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <MDBox py={3} textAlign="center">
        <MDTypography variant="h6">Loading Sprint Metrics...</MDTypography>
      </MDBox>
    );
  }

  return (
    <Card sx={{ height: "100%" }}>
      <MDBox
        mx={2}
        mt={-3}
        py={3}
        px={2}
        variant="gradient"
        bgColor={sidenavColor}
        borderRadius="lg"
        coloredShadow={sidenavColor}
      >
        <MDTypography variant="h6" color="white">
          Sprint Cycle & Lead Time Metrics
        </MDTypography>
      </MDBox>
      <MDBox p={2}>
        <DataTable
          table={tableData}
          entriesPerPage={false}
          canSearch={false}
          showTotalEntries={false}
          pagination={{ variant: "gradient", color: "dark" }}
          isSorted={false}
          noEndBorder={false}
          name="Sprint"
        />
      </MDBox>
    </Card>
  );
}

export default SprintCycleTime;
