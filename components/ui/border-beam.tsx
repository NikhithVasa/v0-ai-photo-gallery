import { cn } from "@/lib/utils"

interface BorderBeamProps {
  /**
   * The size of the border beam.
   */
  size?: number
  /**
   * Kept for API compatibility. Decorative looping motion is intentionally disabled.
   */
  duration?: number
  /**
   * Kept for API compatibility. Decorative looping motion is intentionally disabled.
   */
  delay?: number
  /**
   * The color of the border beam from.
   */
  colorFrom?: string
  /**
   * The color of the border beam to.
   */
  colorTo?: string
  /**
   * Kept for API compatibility. Decorative looping motion is intentionally disabled.
   */
  transition?: unknown
  /**
   * The class name of the border beam.
   */
  className?: string
  /**
   * The style of the border beam.
   */
  style?: React.CSSProperties
  /**
   * Kept for API compatibility. Decorative looping motion is intentionally disabled.
   */
  reverse?: boolean
  /**
   * Kept for API compatibility. Decorative looping motion is intentionally disabled.
   */
  initialOffset?: number
  /**
   * The border width of the beam.
   */
  borderWidth?: number
}

export const BorderBeam = ({
  className,
  size = 50,
  delay: _delay,
  duration: _duration,
  colorFrom = "#ffaa40",
  colorTo = "#9c40ff",
  transition: _transition,
  style,
  reverse: _reverse,
  initialOffset: _initialOffset,
  borderWidth = 1,
}: BorderBeamProps) => {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 rounded-[inherit] border-(length:--border-beam-width) border-transparent mask-[linear-gradient(transparent,transparent),linear-gradient(#000,#000)] mask-intersect [mask-clip:padding-box,border-box]"
      style={
        {
          "--border-beam-width": `${borderWidth}px`,
        } as React.CSSProperties
      }
    >
      <div
        className={cn(
          "absolute aspect-square opacity-40 blur-[0.5px]",
          "bg-linear-to-l from-(--color-from) via-(--color-to) to-transparent",
          className
        )}
        style={
          {
            width: size,
            offsetPath: `rect(0 auto auto 0 round ${size}px)`,
            offsetDistance: "22%",
            "--color-from": colorFrom,
            "--color-to": colorTo,
            ...style,
          } as React.CSSProperties
        }
      />
    </div>
  )
}
