"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import styles from "./full-workflow.module.css";

type WorkflowStep = {
  title: string;
  description: string;
  placeholder: string;
};

const workflowSteps: WorkflowStep[] = [
  {
    title: "Sign up",
    description: "Create your studio account and open your workspace in a few minutes.",
    placeholder: "01-sign-up.mp4 or .gif",
  },
  {
    title: "Create an event",
    description: "Start a wedding and add clear sections such as Ceremony, Reception, and Portraits.",
    placeholder: "02-create-event.mp4 or .gif",
  },
  {
    title: "Upload photos",
    description: "Bulk upload originals while SaathiDesk prepares browser-ready previews in the background.",
    placeholder: "03-upload-photos.mp4 or .gif",
  },
  {
    title: "Share with your client",
    description: "Send one private gallery link when the photographs are ready to view.",
    placeholder: "04-share-client.mp4 or .gif",
  },
  {
    title: "Add a password",
    description: "Protect a private gallery with a passcode and decide whether downloads are available.",
    placeholder: "05-password-protection.mp4 or .gif",
  },
  {
    title: "Cull the shoot",
    description: "Review similar frames together, mark your keepers, and choose the strongest photograph.",
    placeholder: "06-culling.mp4 or .gif",
  },
  {
    title: "Review AI scores",
    description: "Use AI-assisted scores to compare frames quickly, then make the final selection yourself.",
    placeholder: "07-ai-scores.mp4 or .gif",
  },
  {
    title: "Build the gallery grid",
    description: "Choose the cover, order the events, and arrange the gallery before delivery.",
    placeholder: "08-gallery-grid.mp4 or .gif",
  },
  {
    title: "Change the background",
    description: "Set a gallery background that suits the wedding and keeps the photographs readable.",
    placeholder: "09-change-background.mp4 or .gif",
  },
  {
    title: "Choose the grid and fonts",
    description: "Switch the grid style and typography until the gallery feels right for the client.",
    placeholder: "10-grid-style-font.mp4 or .gif",
  },
  {
    title: "Preview the client side",
    description: "Open the public view and check the exact experience your client will receive.",
    placeholder: "11-client-preview.mp4 or .gif",
  },
  {
    title: "Filter by face",
    description: "Select a detected face to bring every matching photograph into one view.",
    placeholder: "12-filter-by-face.mp4 or .gif",
  },
  {
    title: "Search with AI",
    description: "Describe a person, moment, outfit, or scene in plain language and find it across the album.",
    placeholder: "13-ai-search.mp4 or .gif",
  },
  {
    title: "Edit with AI",
    description: "Request a focused photo edit, review the result, and add the version you want to keep.",
    placeholder: "14-ai-edit.mp4 or .gif",
  },
  {
    title: "Share one person",
    description: "Create a restricted link that shows a guest only the photographs containing them.",
    placeholder: "15-share-one-person.mp4 or .gif",
  },
  {
    title: "Select multiple people",
    description: "Choose several people and find the photographs where they appear together in the album.",
    placeholder: "16-select-multiple-people.mp4 or .gif",
  },
  {
    title: "Ignore everyone else",
    description: "Use Only them to keep photos with exactly the selected people and leave the others out.",
    placeholder: "17-only-selected-people.mp4 or .gif",
  },
];

function Arrow({ direction }: { direction: "left" | "right" }) {
  const path = direction === "right"
    ? "M10.293 3.293a1 1 0 0 1 1.414 0l6 6a1 1 0 0 1 0 1.414l-6 6a1 1 0 0 1-1.414-1.414L14.586 11H3a1 1 0 1 1 0-2h11.586l-4.293-4.293a1 1 0 0 1 0-1.414Z"
    : "M9.707 16.707a1 1 0 0 1-1.414 0l-6-6a1 1 0 0 1 0-1.414l6-6a1 1 0 1 1 1.414 1.414L5.414 9H17a1 1 0 1 1 0 2H5.414l4.293 4.293a1 1 0 0 1 0 1.414Z";

  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d={path} fill="currentColor" />
    </svg>
  );
}

export function FullWorkflow() {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const reduceMotion = useReducedMotion();
  const active = workflowSteps[index];

  const selectStep = (nextIndex: number) => {
    if (nextIndex === index) return;
    setDirection(nextIndex > index ? 1 : -1);
    setIndex(nextIndex);
  };

  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <section className={styles.section} aria-labelledby="workflow-heading">
      <div className={styles.headingBlock}>
        <p className={styles.eyebrow}>THE FULL WORKFLOW</p>
        <h2 id="workflow-heading">From upload to review.</h2>
        <p className={styles.intro}>We’re not just another delivery <em>method</em>, we’re the full delivery <strong>workflow</strong>.</p>
      </div>

      <div className={styles.workflow}>
        <div className={styles.mediaViewport}>
          <AnimatePresence initial={false} mode="sync">
            <motion.div
              key={index}
              className={styles.mediaPlaceholder}
              data-media-placeholder={active.placeholder}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={transition}
            >
              <span>MEDIA PLACEHOLDER</span>
              <strong>{active.title}</strong>
              <small>{active.placeholder}</small>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className={styles.stepPanel}>
          <div className={styles.rule} />
          <div className={styles.stepViewport} aria-live="polite">
            <AnimatePresence initial={false} custom={direction} mode="sync">
              <motion.div
                key={index}
                className={styles.step}
                custom={direction}
                initial={{ x: direction * 32, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: direction * -32, opacity: 0 }}
                transition={transition}
              >
                <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{active.title}</h3>
                  <p>{active.description}</p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <nav className={styles.navigation} aria-label="Workflow steps">
            <button
              type="button"
              className={styles.arrowButton}
              onClick={() => selectStep(index - 1)}
              disabled={index === 0}
              aria-label="Previous step"
            >
              <Arrow direction="left" />
            </button>
            <div className={styles.dots}>
              {workflowSteps.map((step, stepIndex) => (
                <button
                  type="button"
                  key={step.title}
                  className={`${styles.dotButton} ${stepIndex === index ? styles.activeDot : ""}`}
                  onClick={() => selectStep(stepIndex)}
                  aria-label={`Go to step ${stepIndex + 1}: ${step.title}`}
                  aria-current={stepIndex === index ? "step" : undefined}
                >
                  <span />
                </button>
              ))}
            </div>
            <button
              type="button"
              className={styles.arrowButton}
              onClick={() => selectStep(index + 1)}
              disabled={index === workflowSteps.length - 1}
              aria-label="Next step"
            >
              <Arrow direction="right" />
            </button>
          </nav>
        </div>
      </div>
    </section>
  );
}
