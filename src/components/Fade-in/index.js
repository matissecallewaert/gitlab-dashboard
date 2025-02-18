import { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { Box } from "@mui/material";

const FadeIn = ({
  children,
  duration = 300,
  fadeInThreshold = 0.3,
  fadeOutThreshold = 0.1,
  fadeOut = true,
  className,
  sx,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio >= fadeInThreshold) {
          // When above fadeInThreshold, fade in
          setTimeout(() => setIsVisible(true), duration);
        } else if (fadeOut && entry.intersectionRatio <= fadeOutThreshold) {
          // When below fadeOutThreshold, fade out
          setTimeout(() => setIsVisible(false), duration);
        }
      },
      { threshold: [fadeOutThreshold, fadeInThreshold] }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => {
      if (elementRef.current) {
        observer.unobserve(elementRef.current);
      }
    };
  }, [duration, fadeInThreshold, fadeOutThreshold, fadeOut]);

  return (
    <Box
      ref={elementRef}
      className={className}
      sx={{
        transition: "all 0.7s ease-out",
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(20px)",
        pointerEvents: isVisible ? "auto" : "none", // Avoid interaction when hidden
        ...sx, // Allow custom styles to be passed
      }}
    >
      {children}
    </Box>
  );
};

FadeIn.defaultProps = {
  duration: 300, // Delay in ms before appearing/disappearing
  fadeInThreshold: 0.3, // Fade in when 30% of the element is visible
  fadeOutThreshold: 0.1, // Fade out when 10% or less is visible
  fadeOut: true, // Enable fade-out by default
  className: "",
  sx: {},
};

FadeIn.propTypes = {
  children: PropTypes.node.isRequired,
  duration: PropTypes.number,
  fadeInThreshold: PropTypes.number,
  fadeOutThreshold: PropTypes.number,
  fadeOut: PropTypes.bool,
  className: PropTypes.string,
  sx: PropTypes.object,
};

export default FadeIn;
