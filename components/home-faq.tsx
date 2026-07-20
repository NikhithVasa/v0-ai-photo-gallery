"use client";

import { useState } from "react";
import styles from "./home-faq.module.css";

type Faq = {
  question: string;
  answer: string;
};

type FaqGroup = {
  title: string;
  items: Faq[];
};

const faqGroups: FaqGroup[] = [
  {
    title: "Using SaathiDesk",
    items: [
      {
        question: "What is SaathiDesk?",
        answer:
          "SaathiDesk is an open-source workspace for wedding photographers. It keeps uploads, events, culling, people search, client galleries, and delivery in one place.",
      },
      {
        question: "Which photo formats can I upload?",
        answer:
          "You can upload JPEG, PNG, WebP, HEIC or HEIF, TIFF, BMP, JFIF, and common RAW files including NEF, CR2, ARW, and DNG. SaathiDesk stores the originals and creates browser-ready previews for formats that browsers cannot display directly.",
      },
      {
        question: "How does people search work?",
        answer:
          "SaathiDesk groups detected faces into people profiles. You can review and merge those profiles, then find photographs of a person by selecting their face. Search also works with captions and visual descriptions.",
      },
    ],
  },
  {
    title: "Sharing and privacy",
    items: [
      {
        question: "Can I share photos of just one person?",
        answer:
          "Yes. Create a person-specific share link when a guest should only see photographs that include them. Use a full-gallery link when the couple or client can browse the complete album.",
      },
      {
        question: "Can clients download their photos?",
        answer:
          "You decide. Each share link can allow downloads or remain view-only. You can also add watermarks to public previews before sending the gallery.",
      },
      {
        question: "How do I keep a gallery private?",
        answer:
          "Add a passcode and send the share link only to the people who need it. SaathiDesk marks client and share pages so search engines should not index them, but you should still avoid posting private links publicly.",
      },
    ],
  },
];

function FaqItem({ item, id }: { item: Faq; id: string }) {
  const [open, setOpen] = useState(false);
  const answerId = `${id}-answer`;

  return (
    <article className={`${styles.item} ${open ? styles.open : ""}`}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={answerId}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{item.question}</span>
        <span className={styles.icon} aria-hidden="true">
          <span className={styles.horizontal} />
          <span className={styles.vertical} />
        </span>
      </button>
      <div className={styles.answerGrid} id={answerId} aria-hidden={!open}>
        <div className={styles.answerClip}>
          <p>{item.answer}</p>
        </div>
      </div>
    </article>
  );
}

export function HomeFaq() {
  return (
    <section className={styles.section} aria-labelledby="faq-heading">
      <div className={styles.container}>
        <h2 id="faq-heading" className={styles.heading}>Frequently asked questions</h2>

        <div className={styles.groups}>
          {faqGroups.map((group, groupIndex) => (
            <section className={styles.group} aria-labelledby={`faq-group-${groupIndex}`} key={group.title}>
              <h3 id={`faq-group-${groupIndex}`} className={styles.groupTitle}>{group.title}</h3>
              <div className={styles.items}>
                {group.items.map((item, itemIndex) => (
                  <FaqItem item={item} id={`faq-${groupIndex}-${itemIndex}`} key={item.question} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
