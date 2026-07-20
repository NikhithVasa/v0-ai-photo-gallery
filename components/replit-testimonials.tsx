"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import styles from "./replit-testimonials.module.css";

type Testimonial = {
  quote: string;
  name: string;
  role: string;
  company: string;
  photo: string;
};

const testimonials: Testimonial[] = [
  {
    quote:
      "Setup was easy. I uploaded the photos and shared the gallery with my clients right away. Because it is open source, I stopped paying hundreds of dollars every month for tools with half the features. My developer had my account running in 30 minutes. Impressive.",
    name: "Wedding photographer",
    role: "Studio owner",
    company: "Independent studio",
    photo: "/testimonials/ali-ghodsi.jpg",
  },
  {
    quote:
      "I found every photo of my grandmother just by clicking her face. It was so easy, and seeing all those moments together made the gallery even more memorable. I love it.",
    name: "Wedding customer",
    role: "Gallery guest",
    company: "Family wedding gallery",
    photo: "/testimonials/doug-rodermund.png",
  },
  {
    quote:
      "A couple asked for every photo with their grandparents. I found the whole set in minutes instead of going back through thousands of frames. That is the kind of search I actually need.",
    name: "Documentary photographer",
    role: "Lead photographer",
    company: "Wedding studio",
    photo: "/testimonials/alex-meyers.png",
  },
  {
    quote:
      "Culling used to be the part of the job I kept putting off. Having the similar frames grouped together makes it much easier to choose the strongest expression without losing the little moments around it.",
    name: "Wedding photographer",
    role: "Owner and editor",
    company: "Independent studio",
    photo: "/testimonials/barak-hirchson.png",
  },
  {
    quote:
      "The gallery feels clean and considered when it reaches the couple. They can enjoy the photographs, share them with family, and download what they need without coming back to me for every small thing.",
    name: "Portrait photographer",
    role: "Client gallery lead",
    company: "Photography studio",
    photo: "/testimonials/shauna-geraghty.jpg",
  },
  {
    quote:
      "I can keep the whole wedding together, from the first card backup to the final gallery. I spend less time checking where things are and more time making sure the story of the day feels right.",
    name: "Wedding photographer",
    role: "Photographer and editor",
    company: "Independent studio",
    photo: "/testimonials/takeshi-fujiwara.png",
  },
];

const slideVariants = {
  enter: (direction: number) => ({ x: `${direction * 100}%` }),
  center: { x: "0%" },
  exit: (direction: number) => ({ x: `${direction * -100}%` }),
};

function Arrow({ direction }: { direction: "left" | "right" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path
        d={direction === "right" ? "M5 12h13m-5-5 5 5-5 5" : "M19 12H6m5 5-5-5 5-5"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Author({ testimonial }: { testimonial: Testimonial }) {
  return (
    <div className={styles.authorDetails}>
      <span className={styles.authorName}>{testimonial.name}</span>
      <span className={styles.authorInfo}>{testimonial.role}</span>
      <span className={styles.authorInfo}>{testimonial.company}</span>
    </div>
  );
}

export function ReplitTestimonials() {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const reduceMotion = useReducedMotion();
  const active = testimonials[index];

  const move = (step: number) => {
    setDirection(step);
    setIndex((current) => (current + step + testimonials.length) % testimonials.length);
  };

  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <section className={styles.section} aria-labelledby="testimonials-heading">
      <div className={styles.desktopLayout}>
        <div className={styles.desktopViewport}>
          <AnimatePresence initial={false} custom={direction} mode="sync">
            <motion.article
              key={index}
              className={styles.desktopSlide}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transition}
            >
              <div className={styles.desktopGrid}>
                <div className={styles.quoteCard}>
                  <div>
                    <span className={styles.quoteIcon} aria-hidden="true">“</span>
                    <h3 className={styles.quoteText}>{active.quote}</h3>
                  </div>
                  <Author testimonial={active} />
                </div>
                <div className={styles.photoCell}>
                  <Image src={active.photo} alt={active.name} fill sizes="19vw" className={styles.photo} />
                </div>
              </div>
            </motion.article>
          </AnimatePresence>
        </div>

        <div className={styles.headingCell}>
          <h2 id="testimonials-heading">Trusted by photographers</h2>
          <p>Made for real wedding workflows</p>
        </div>

        <div className={styles.desktopNavigation}>
          <svg className={styles.bubbleShape} viewBox="0 0 518 518" fill="none" aria-hidden="true">
            <path d="M329 0 H448 Q518 0 518 70 V189 Q518 259 448 259 H329 Q259 259 259 329 V448 Q259 518 189 518 H70 Q0 518 0 448 V329 Q0 259 70 259 H189 Q259 259 259 189 V70 Q259 0 329 0 Z" fill="#FFB199" />
          </svg>
          <div className={styles.nextBubble}>
            <button type="button" onClick={() => move(1)} aria-label="Next testimonial">
              <span>Next<br />Testimonial</span>
              <Arrow direction="right" />
            </button>
          </div>
          <div className={styles.previousBubble}>
            <button type="button" onClick={() => move(-1)} aria-label="Previous testimonial">
              <Arrow direction="left" />
              <span>Previous<br />Testimonial</span>
            </button>
          </div>
        </div>
      </div>

      <div className={styles.mobileLayout}>
        <header className={styles.mobileHeader}>
          <p>Made for real wedding workflows</p>
          <h2>Trusted by photographers</h2>
        </header>
        <div className={styles.mobileViewport}>
          <AnimatePresence initial={false} custom={direction} mode="sync">
            <motion.article
              key={index}
              className={styles.mobileCard}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transition}
            >
              <div>
                <span className={styles.mobileQuoteIcon} aria-hidden="true">“</span>
                <h3 className={styles.mobileQuote}>{active.quote}</h3>
              </div>
              <div className={styles.mobileAuthorRow}>
                <div className={styles.mobilePhoto}>
                  <Image src={active.photo} alt={active.name} fill sizes="100px" className={styles.photo} />
                </div>
                <Author testimonial={active} />
              </div>
            </motion.article>
          </AnimatePresence>
        </div>
        <div className={styles.mobileControls}>
          <div className={styles.dots} aria-label={`Testimonial ${index + 1} of ${testimonials.length}`}>
            {testimonials.map((testimonial, dotIndex) => (
              <span key={`${testimonial.name}-${dotIndex}`} className={dotIndex === index ? styles.activeDot : undefined} />
            ))}
          </div>
          <div className={styles.mobileButtons}>
            <button type="button" onClick={() => move(-1)} aria-label="Previous testimonial"><Arrow direction="left" /></button>
            <button type="button" onClick={() => move(1)} aria-label="Next testimonial"><Arrow direction="right" /></button>
          </div>
        </div>
      </div>
    </section>
  );
}
