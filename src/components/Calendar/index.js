import React from "react";
import PropTypes from "prop-types";
import Card from "@mui/material/Card";
import MDBox from "components/MDBox";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import googleCalendarPlugin from "@fullcalendar/google-calendar";
import { useMaterialUIController } from "context";
import "./schedule.css";

const FullCalendarCard = ({ initialView }) => {
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

  const googleCalendarApiKey = process.env.REACT_APP_GOOGLE_CALENDAR_API_KEY;
  const calendarId = process.env.REACT_APP_GOOGLE_CALENDAR_ID;

  return (
    <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <MDBox
        sx={{ flexGrow: 1, overflow: "auto", padding: 2 }}
        className={darkMode ? "dark-mode" : ""}
      >
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, googleCalendarPlugin]}
          initialView={initialView}
          googleCalendarApiKey={googleCalendarApiKey}
          events={{ googleCalendarId: calendarId }}
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

FullCalendarCard.defaultProps = {
  initialView: "dayGridMonth",
};

FullCalendarCard.propTypes = {
  initialView: PropTypes.string,
};

export default FullCalendarCard;
