import React from "react";
import PropTypes from "prop-types";
import Card from "@mui/material/Card";
import MDBox from "components/MDBox";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import { useMaterialUIController } from "context";
import "./schedule.css";

const FullCalendarCard = ({ events, initialView }) => {
  const [controller] = useMaterialUIController();
  const { darkMode, sidenavColor } = controller;

  const colorMap = {
    primary: "#e91e63",
    dark: "#2c3c58",
    info: "#1A73E8",
    success: "#4CAF50",
    warning: "#fb8c00",
    error: "#F44335",
  };

  return (
    <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <MDBox
        sx={{ flexGrow: 1, overflow: "auto", padding: 2 }}
        className={darkMode ? "dark-mode" : ""}
      >
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin]}
          initialView={initialView}
          events={events}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          slotDuration="00:30:00"
          scrollTime="08:00:00"
          height="100%"
          eventColor={colorMap[sidenavColor] || "#2c3c58"}
        />
      </MDBox>
    </Card>
  );
};

// Set default props
FullCalendarCard.defaultProps = {
  initialView: "timeGridWeek",
};

// Prop type validation
FullCalendarCard.propTypes = {
  events: PropTypes.array.isRequired,
  initialView: PropTypes.string,
};

export default FullCalendarCard;
