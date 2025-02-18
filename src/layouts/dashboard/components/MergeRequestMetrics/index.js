import React, { useState, useEffect } from "react";
import Card from "@mui/material/Card";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import DataTable from "examples/Employees/DataTable";
import { emojify } from "node-emoji";
import { useMaterialUIController } from "context";

function MergeRequestMetrics() {
  const [tableData, setTableData] = useState({ columns: [], rows: [] });
  const [loading, setLoading] = useState(true);
  const [controller] = useMaterialUIController();
  const { sidenavColor } = controller;
  const group = process.env.REACT_APP_GITLAB_GROUP;
  const url = process.env.REACT_APP_GITLAB_URL;
  const token = process.env.REACT_APP_GITLAB_TOKEN;

  useEffect(() => {
    async function fetchMergeRequests() {
      const query = `
        query {
          group(fullPath: "${group}") {
            mergeRequests(includeSubgroups: true, first: 100) {
              nodes {
                title
                createdAt
                mergedAt
                approvedBy {
                  nodes {
                    username
                  }
                }
                notes(first: 100) {
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
            // Replace with your actual GitLab private token
            Authorization: token,
          },
          body: JSON.stringify({ query }),
        });
        const result = await response.json();
        const mergeRequests = result.data.group.mergeRequests.nodes;

        // Sort merge requests by createdAt in descending order (newest first)
        const sortedMergeRequests = mergeRequests.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );

        const rows = sortedMergeRequests.map((mr) => {
          let mergeDuration = "N/A";
          if (mr.mergedAt) {
            const created = new Date(mr.createdAt);
            const merged = new Date(mr.mergedAt);
            mergeDuration = ((merged - created) / (1000 * 60 * 60)).toFixed(2); // in hours
          }
          const approvalsCount = mr.approvedBy.nodes.length;
          const commentsCount = mr.notes.nodes.length;

          return {
            title: emojify(mr.title),
            mergeDuration,
            approvalsCount,
            commentsCount,
          };
        });

        const columns = [
          { Header: "Merge Request", accessor: "title", align: "left" },
          { Header: "Merge Duration (hours)", accessor: "mergeDuration", align: "right" },
          { Header: "Approvals", accessor: "approvalsCount", align: "right" },
          { Header: "Comments", accessor: "commentsCount", align: "right" },
        ];

        setTableData({ columns, rows });
      } catch (error) {
        console.error("Error fetching merge request data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchMergeRequests();
  }, []);

  if (loading) {
    return (
      <MDBox py={3} textAlign="center">
        <MDTypography variant="h6">Loading Merge Request Metrics...</MDTypography>
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
          Merge Request Metrics
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
          name="Merge Request"
        />
      </MDBox>
    </Card>
  );
}

export default MergeRequestMetrics;
