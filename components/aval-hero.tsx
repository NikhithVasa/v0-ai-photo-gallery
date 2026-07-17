export function AvalHero() {
  return (
    <>
      <img
        src="/aval/hero.png"
        alt=""
        className="pointer-events-none absolute inset-0 block h-full w-full object-cover"
      />
      <video
        autoPlay
        loop
        muted
        playsInline
        poster="/aval/hero.png"
        preload="metadata"
        aria-hidden="true"
        tabIndex={-1}
        className="pointer-events-none absolute inset-0 block h-full w-full object-cover motion-reduce:hidden"
      >
        <source
          src="https://videodd.s3.us-east-1.amazonaws.com/Generated+Video+July+16%2C+2026+-+7_19PM.mp4"
          type="video/mp4"
        />
      </video>
    </>
  );
}
