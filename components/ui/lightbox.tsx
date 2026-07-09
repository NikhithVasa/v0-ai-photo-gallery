'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Slot } from '@radix-ui/react-slot'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MinusIcon,
  PlusIcon,
  RotateCcwIcon,
  XIcon,
} from 'lucide-react'

import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock'
import { cn } from '@/lib/utils'

type LightboxTransform = {
  scale: number
  x: number
  y: number
}

type LightboxContextValue = {
  closeOnBackdropTap: boolean
  closeOnDragDown: boolean
  close: () => void
  goToIndex: (index: number) => void
  canGoNext: boolean
  canGoPrevious: boolean
  index: number
  itemCount: number
  lastIndex: number
  loop: boolean
  maxZoom: number
  minZoom: number
  next: () => void
  open: boolean
  previous: () => void
  registerSlide: (index: number) => () => void
  resetTransform: () => void
  setOpen: (open: boolean) => void
  setTransform: React.Dispatch<React.SetStateAction<LightboxTransform>>
  transform: LightboxTransform
  zoomIn: () => void
  zoomOut: () => void
  zoomStep: number
}

type LightboxProps = Omit<
  React.ComponentProps<typeof DialogPrimitive.Root>,
  'open' | 'defaultOpen' | 'onOpenChange'
> & {
  closeOnBackdropTap?: boolean
  closeOnDragDown?: boolean
  defaultIndex?: number
  defaultOpen?: boolean
  index?: number
  itemCount?: number
  loop?: boolean
  maxZoom?: number
  minZoom?: number
  onIndexChange?: (index: number) => void
  onOpenChange?: (open: boolean) => void
  open?: boolean
  zoomStep?: number
}

const LightboxContext = React.createContext<LightboxContextValue | null>(null)
const defaultTransform: LightboxTransform = { scale: 1, x: 0, y: 0 }

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function useControllableState<T>({
  prop,
  defaultProp,
  onChange,
}: {
  prop: T | undefined
  defaultProp: T
  onChange?: (value: T) => void
}) {
  const [internalValue, setInternalValue] = React.useState(defaultProp)
  const isControlled = prop !== undefined
  const value = isControlled ? prop : internalValue

  const setValue = React.useCallback(
    (nextValue: T | ((previousValue: T) => T)) => {
      const resolvedValue =
        typeof nextValue === 'function'
          ? (nextValue as (previousValue: T) => T)(value)
          : nextValue

      if (!isControlled) {
        setInternalValue(resolvedValue)
      }

      if (!Object.is(value, resolvedValue)) {
        onChange?.(resolvedValue)
      }
    },
    [isControlled, onChange, value],
  )

  return [value, setValue] as const
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] =
    React.useState(false)

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)

    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)

    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return prefersReducedMotion
}

function useLightbox() {
  const context = React.useContext(LightboxContext)

  if (!context) {
    throw new Error('useLightbox must be used within a <Lightbox />')
  }

  return context
}

function Lightbox({
  closeOnBackdropTap = true,
  closeOnDragDown = true,
  defaultIndex = 0,
  defaultOpen = false,
  index: indexProp,
  itemCount: itemCountProp,
  loop = true,
  maxZoom = 4,
  minZoom = 1,
  onIndexChange,
  onOpenChange,
  open: openProp,
  zoomStep = 0.5,
  ...props
}: LightboxProps) {
  const [open, setOpen] = useControllableState({
    prop: openProp,
    defaultProp: defaultOpen,
    onChange: onOpenChange,
  })
  const [index, setIndex] = useControllableState({
    prop: indexProp,
    defaultProp: defaultIndex,
    onChange: onIndexChange,
  })
  const [registeredSlides, setRegisteredSlides] = React.useState<number[]>([])
  const [transform, setTransform] =
    React.useState<LightboxTransform>(defaultTransform)

  useBodyScrollLock(Boolean(open))

  const lastIndex = React.useMemo(() => {
    if (typeof itemCountProp === 'number') return Math.max(0, itemCountProp - 1)
    return Math.max(0, ...registeredSlides)
  }, [itemCountProp, registeredSlides])
  const itemCount = itemCountProp ?? registeredSlides.length

  const resetTransform = React.useCallback(() => {
    setTransform(defaultTransform)
  }, [])

  const goToIndex = React.useCallback(
    (nextIndex: number) => {
      if (itemCount === 0 && typeof itemCountProp === 'number') return

      const resolvedIndex = loop
        ? ((nextIndex % (lastIndex + 1)) + lastIndex + 1) % (lastIndex + 1)
        : clamp(nextIndex, 0, lastIndex)

      setIndex(resolvedIndex)
    },
    [itemCount, itemCountProp, lastIndex, loop, setIndex],
  )

  const previous = React.useCallback(() => {
    goToIndex(index - 1)
  }, [goToIndex, index])

  const next = React.useCallback(() => {
    goToIndex(index + 1)
  }, [goToIndex, index])

  const registerSlide = React.useCallback((slideIndex: number) => {
    setRegisteredSlides((currentSlides) => {
      if (currentSlides.includes(slideIndex)) return currentSlides
      return [...currentSlides, slideIndex].sort((a, b) => a - b)
    })

    return () => {
      setRegisteredSlides((currentSlides) =>
        currentSlides.filter((currentIndex) => currentIndex !== slideIndex),
      )
    }
  }, [])

  const zoomTo = React.useCallback(
    (scale: number) => {
      setTransform((currentTransform) => {
        const nextScale = clamp(scale, minZoom, maxZoom)

        if (nextScale <= minZoom) {
          return defaultTransform
        }

        return { ...currentTransform, scale: nextScale }
      })
    },
    [maxZoom, minZoom],
  )

  const zoomIn = React.useCallback(() => {
    zoomTo(transform.scale + zoomStep)
  }, [transform.scale, zoomStep, zoomTo])

  const zoomOut = React.useCallback(() => {
    zoomTo(transform.scale - zoomStep)
  }, [transform.scale, zoomStep, zoomTo])

  React.useEffect(() => {
    resetTransform()
  }, [index, open, resetTransform])

  React.useEffect(() => {
    if (index > lastIndex) {
      setIndex(lastIndex)
    }
  }, [index, lastIndex, setIndex])

  const contextValue = React.useMemo<LightboxContextValue>(
    () => ({
      closeOnBackdropTap,
      closeOnDragDown,
      close: () => setOpen(false),
      goToIndex,
      canGoNext: loop || index < lastIndex,
      canGoPrevious: loop || index > 0,
      index,
      itemCount,
      lastIndex,
      loop,
      maxZoom,
      minZoom,
      next,
      open,
      previous,
      registerSlide,
      resetTransform,
      setOpen,
      setTransform,
      transform,
      zoomIn,
      zoomOut,
      zoomStep,
    }),
    [
      closeOnBackdropTap,
      closeOnDragDown,
      goToIndex,
      index,
      itemCount,
      lastIndex,
      loop,
      maxZoom,
      minZoom,
      next,
      open,
      previous,
      registerSlide,
      resetTransform,
      setOpen,
      setTransform,
      transform,
      zoomIn,
      zoomOut,
      zoomStep,
    ],
  )

  return (
    <LightboxContext.Provider value={contextValue}>
      <DialogPrimitive.Root
        data-slot="lightbox"
        open={open}
        onOpenChange={setOpen}
        {...props}
      />
    </LightboxContext.Provider>
  )
}

function LightboxTrigger({
  index,
  onClick,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger> & {
  index?: number
}) {
  const lightbox = useLightbox()

  return (
    <DialogPrimitive.Trigger
      data-slot="lightbox-trigger"
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented && typeof index === 'number') {
          lightbox.goToIndex(index)
        }
      }}
      {...props}
    />
  )
}

function LightboxPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="lightbox-portal" {...props} />
}

function LightboxOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="lightbox-overlay"
      className={cn(
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/95 backdrop-blur-sm',
        className,
      )}
      {...props}
    />
  )
}

function LightboxContent({
  className,
  children,
  onKeyDown,
  onOpenAutoFocus,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  const contentRef = React.useRef<HTMLDivElement>(null)
  const lightbox = useLightbox()

  return (
    <LightboxPortal>
      <LightboxOverlay />
      <DialogPrimitive.Content
        ref={contentRef}
        data-slot="lightbox-content"
        tabIndex={-1}
        className={cn(
          'fixed inset-0 z-50 flex flex-col overflow-hidden text-white outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-98 data-[state=open]:zoom-in-98 duration-200',
          className,
        )}
        onKeyDown={(event) => {
          onKeyDown?.(event)
          if (event.defaultPrevented) return

          if (event.key === 'ArrowLeft') {
            event.preventDefault()
            lightbox.previous()
          } else if (event.key === 'ArrowRight') {
            event.preventDefault()
            lightbox.next()
          } else if (event.key === 'Home') {
            event.preventDefault()
            lightbox.goToIndex(0)
          } else if (event.key === 'End') {
            event.preventDefault()
            lightbox.goToIndex(lightbox.lastIndex)
          } else if (event.key === '+' || event.key === '=') {
            event.preventDefault()
            lightbox.zoomIn()
          } else if (event.key === '-') {
            event.preventDefault()
            lightbox.zoomOut()
          } else if (event.key === '0') {
            event.preventDefault()
            lightbox.resetTransform()
          }
        }}
        onOpenAutoFocus={(event) => {
          onOpenAutoFocus?.(event)
          if (event.defaultPrevented) return

          event.preventDefault()
          requestAnimationFrame(() => contentRef.current?.focus())
        }}
        {...props}
      >
        {children}
        {showCloseButton && <LightboxClose className="absolute top-4 right-4" />}
      </DialogPrimitive.Content>
    </LightboxPortal>
  )
}

function getPointerDistance(pointers: PointerInfo[]) {
  const [firstPointer, secondPointer] = pointers
  return Math.hypot(
    firstPointer.x - secondPointer.x,
    firstPointer.y - secondPointer.y,
  )
}

type PointerInfo = {
  x: number
  y: number
}

function LightboxViewport({
  className,
  children,
  onDoubleClick,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onWheel,
  style,
  ...props
}: React.ComponentProps<'div'>) {
  const lightbox = useLightbox()
  const prefersReducedMotion = usePrefersReducedMotion()
  const pointersRef = React.useRef(new Map<number, PointerInfo>())
  const gestureRef = React.useRef({
    pinching: false,
    pinchDistance: 0,
    pinchScale: 1,
    startOffsetX: 0,
    startOffsetY: 0,
    startX: 0,
    startY: 0,
  })
  const transformRef = React.useRef(lightbox.transform)
  const [isDragging, setIsDragging] = React.useState(false)
  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 })

  React.useEffect(() => {
    transformRef.current = lightbox.transform
  }, [lightbox.transform])

  const endGesture = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const currentTransform = transformRef.current
      const dx = event.clientX - gestureRef.current.startX
      const dy = event.clientY - gestureRef.current.startY

      setIsDragging(false)
      setDragOffset({ x: 0, y: 0 })

      if (gestureRef.current.pinching) {
        gestureRef.current.pinching = false
        if (currentTransform.scale <= lightbox.minZoom + 0.02) {
          lightbox.resetTransform()
        }
        return
      }

      if (currentTransform.scale > lightbox.minZoom) return

      if (Math.abs(dx) > 64 && Math.abs(dx) > Math.abs(dy) * 1.1) {
        if (dx < 0) lightbox.next()
        else lightbox.previous()
      } else if (
        lightbox.closeOnDragDown &&
        dy > 120 &&
        Math.abs(dy) > Math.abs(dx)
      ) {
        lightbox.close()
      } else if (
        lightbox.closeOnBackdropTap &&
        Math.abs(dx) < 6 &&
        Math.abs(dy) < 6 &&
        event.target === event.currentTarget
      ) {
        lightbox.close()
      }
    },
    [lightbox],
  )

  const handlePointerEnd = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      pointersRef.current.delete(event.pointerId)
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      endGesture(event)
    },
    [endGesture],
  )

  const trackTransform = `translate3d(calc(${-lightbox.index * 100}% + ${dragOffset.x}px), ${dragOffset.y}px, 0)`
  const dragProgress = clamp(dragOffset.y / 360, 0, 0.65)

  return (
    <div
      data-dragging={isDragging ? '' : undefined}
      data-slot="lightbox-viewport"
      data-zoomed={lightbox.transform.scale > lightbox.minZoom ? '' : undefined}
      role="group"
      aria-roledescription="slide viewer"
      aria-live="polite"
      className={cn(
        'relative flex min-h-0 flex-1 touch-none select-none overflow-hidden overscroll-none cursor-zoom-in',
        lightbox.transform.scale > lightbox.minZoom && 'cursor-grab active:cursor-grabbing',
        className,
      )}
      style={{ opacity: 1 - dragProgress, ...style }}
      onDoubleClick={(event) => {
        onDoubleClick?.(event)
        if (event.defaultPrevented) return

        if (lightbox.transform.scale > lightbox.minZoom) {
          lightbox.resetTransform()
        } else {
          lightbox.setTransform((currentTransform) => ({
            ...currentTransform,
            scale: Math.min(lightbox.maxZoom, 2),
          }))
        }
      }}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        if (event.defaultPrevented) return
        if (event.pointerType === 'mouse' && event.button !== 0) return

        event.currentTarget.setPointerCapture(event.pointerId)
        pointersRef.current.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
        })

        if (pointersRef.current.size === 2) {
          const pointers = Array.from(pointersRef.current.values())
          gestureRef.current.pinching = true
          gestureRef.current.pinchDistance = getPointerDistance(pointers)
          gestureRef.current.pinchScale = transformRef.current.scale
          setIsDragging(false)
          setDragOffset({ x: 0, y: 0 })
          return
        }

        gestureRef.current.startX = event.clientX
        gestureRef.current.startY = event.clientY
        gestureRef.current.startOffsetX = transformRef.current.x
        gestureRef.current.startOffsetY = transformRef.current.y
        setIsDragging(true)
      }}
      onPointerMove={(event) => {
        onPointerMove?.(event)
        if (event.defaultPrevented) return
        if (!pointersRef.current.has(event.pointerId)) return

        pointersRef.current.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
        })

        if (gestureRef.current.pinching && pointersRef.current.size >= 2) {
          event.preventDefault()
          const pointers = Array.from(pointersRef.current.values()).slice(0, 2)
          const pinchDistance = getPointerDistance(pointers)
          const nextScale =
            gestureRef.current.pinchScale *
            (pinchDistance / gestureRef.current.pinchDistance)

          lightbox.setTransform((currentTransform) => ({
            ...currentTransform,
            scale: clamp(nextScale, lightbox.minZoom, lightbox.maxZoom),
          }))
          return
        }

        const dx = event.clientX - gestureRef.current.startX
        const dy = event.clientY - gestureRef.current.startY

        if (transformRef.current.scale > lightbox.minZoom) {
          event.preventDefault()
          lightbox.setTransform((currentTransform) => ({
            ...currentTransform,
            x: gestureRef.current.startOffsetX + dx,
            y: gestureRef.current.startOffsetY + dy,
          }))
          return
        }

        if (!isDragging) return
        setDragOffset({ x: dx, y: Math.max(0, dy) })
      }}
      onPointerUp={(event) => {
        onPointerUp?.(event)
        if (!event.defaultPrevented) handlePointerEnd(event)
      }}
      onPointerCancel={(event) => {
        onPointerCancel?.(event)
        if (!event.defaultPrevented) handlePointerEnd(event)
      }}
      onWheel={(event) => {
        onWheel?.(event)
        if (event.defaultPrevented) return

        if (event.ctrlKey || event.metaKey) {
          event.preventDefault()
          lightbox.setTransform((currentTransform) => {
            const nextScale = clamp(
              currentTransform.scale - event.deltaY * 0.003,
              lightbox.minZoom,
              lightbox.maxZoom,
            )

            if (nextScale <= lightbox.minZoom) return defaultTransform
            return { ...currentTransform, scale: nextScale }
          })
        } else if (lightbox.transform.scale > lightbox.minZoom) {
          event.preventDefault()
          lightbox.setTransform((currentTransform) => ({
            ...currentTransform,
            x: currentTransform.x - event.deltaX,
            y: currentTransform.y - event.deltaY,
          }))
        }
      }}
      {...props}
    >
      <div
        data-slot="lightbox-track"
        className="flex h-full w-full shrink-0 transition-transform duration-300 ease-out will-change-transform"
        style={{
          transform: trackTransform,
          transitionDuration:
            isDragging || prefersReducedMotion ? '0ms' : undefined,
        }}
      >
        {children}
      </div>
    </div>
  )
}

function LightboxSlide({
  className,
  index,
  ...props
}: React.ComponentProps<'div'> & {
  index: number
}) {
  const lightbox = useLightbox()
  const { registerSlide } = lightbox
  const isActive = lightbox.index === index

  React.useEffect(() => {
    return registerSlide(index)
  }, [index, registerSlide])

  return (
    <div
      data-active={isActive ? '' : undefined}
      data-slot="lightbox-slide"
      aria-hidden={!isActive}
      className={cn(
        'flex h-full w-full shrink-0 items-center justify-center px-4 py-16 sm:px-10',
        className,
      )}
      {...props}
    />
  )
}

function LightboxImage({
  alt,
  className,
  draggable = false,
  style,
  ...props
}: React.ComponentProps<'img'>) {
  const lightbox = useLightbox()

  return (
    <img
      data-slot="lightbox-image"
      data-zoomed={lightbox.transform.scale > lightbox.minZoom ? '' : undefined}
      alt={alt}
      draggable={draggable}
      className={cn(
        'max-h-full max-w-full select-none object-contain transition-transform duration-200 ease-out will-change-transform',
        className,
      )}
      style={{
        transform: `translate3d(${lightbox.transform.x}px, ${lightbox.transform.y}px, 0) scale(${lightbox.transform.scale})`,
        ...style,
      }}
      {...props}
    />
  )
}

function LightboxZoomable({
  className,
  style,
  ...props
}: React.ComponentProps<'div'>) {
  const lightbox = useLightbox()

  return (
    <div
      data-slot="lightbox-zoomable"
      data-zoomed={lightbox.transform.scale > lightbox.minZoom ? '' : undefined}
      className={cn(
        'transition-transform duration-200 ease-out will-change-transform',
        className,
      )}
      style={{
        transform: `translate3d(${lightbox.transform.x}px, ${lightbox.transform.y}px, 0) scale(${lightbox.transform.scale})`,
        ...style,
      }}
      {...props}
    />
  )
}

function LightboxToolbar({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="lightbox-toolbar"
      className={cn(
        'pointer-events-none absolute inset-x-0 top-0 z-10 flex min-h-14 items-center justify-end gap-2 p-3 text-white sm:p-4 [&>*]:pointer-events-auto',
        className,
      )}
      {...props}
    />
  )
}

function LightboxCaption({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="lightbox-caption"
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-0 z-10 px-4 py-5 text-center text-sm text-white/80 sm:px-10',
        className,
      )}
      {...props}
    />
  )
}

function LightboxTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="lightbox-title"
      className={cn('sr-only', className)}
      {...props}
    />
  )
}

function LightboxCounter({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'div'>, 'children'> & {
  children?:
    | React.ReactNode
    | ((state: { index: number; itemCount: number }) => React.ReactNode)
}) {
  const lightbox = useLightbox()
  const content =
    typeof children === 'function'
      ? children({ index: lightbox.index, itemCount: lightbox.itemCount })
      : (children ?? `${lightbox.index + 1} / ${lightbox.itemCount}`)

  return (
    <div
      data-slot="lightbox-counter"
      className={cn(
        'rounded-full bg-black/45 px-3 py-1 text-xs font-medium text-white shadow-sm backdrop-blur-md',
        className,
      )}
      {...props}
    >
      {content}
    </div>
  )
}

type LightboxButtonProps = React.ComponentProps<'button'> & {
  asChild?: boolean
}

function LightboxButton({
  asChild = false,
  className,
  ...props
}: LightboxButtonProps) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      {...(!asChild ? { type: props.type ?? 'button' } : undefined)}
      className={cn(
        'inline-flex size-11 cursor-pointer items-center justify-center rounded-full bg-black/45 text-white shadow-sm backdrop-blur-md transition hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:outline-none disabled:pointer-events-none disabled:opacity-35 [&_svg]:size-5',
        className,
      )}
      {...props}
    />
  )
}

function LightboxClose({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return (
    <DialogPrimitive.Close asChild>
      <LightboxButton
        data-slot="lightbox-close"
        className={className}
        aria-label="Close lightbox"
        {...props}
      >
        {children ?? <XIcon />}
      </LightboxButton>
    </DialogPrimitive.Close>
  )
}

function LightboxPrevious({
  className,
  children,
  onClick,
  ...props
}: LightboxButtonProps) {
  const lightbox = useLightbox()

  return (
    <LightboxButton
      data-slot="lightbox-previous"
      className={cn('absolute top-1/2 left-3 z-10 -translate-y-1/2 sm:left-4', className)}
      aria-label="Previous image"
      disabled={!lightbox.canGoPrevious}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) lightbox.previous()
      }}
      {...props}
    >
      {children ?? <ChevronLeftIcon />}
    </LightboxButton>
  )
}

function LightboxNext({
  className,
  children,
  onClick,
  ...props
}: LightboxButtonProps) {
  const lightbox = useLightbox()

  return (
    <LightboxButton
      data-slot="lightbox-next"
      className={cn('absolute top-1/2 right-3 z-10 -translate-y-1/2 sm:right-4', className)}
      aria-label="Next image"
      disabled={!lightbox.canGoNext}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) lightbox.next()
      }}
      {...props}
    >
      {children ?? <ChevronRightIcon />}
    </LightboxButton>
  )
}

function LightboxZoomIn({
  className,
  children,
  onClick,
  ...props
}: LightboxButtonProps) {
  const lightbox = useLightbox()

  return (
    <LightboxButton
      data-slot="lightbox-zoom-in"
      className={className}
      aria-label="Zoom in"
      disabled={lightbox.transform.scale >= lightbox.maxZoom}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) lightbox.zoomIn()
      }}
      {...props}
    >
      {children ?? <PlusIcon />}
    </LightboxButton>
  )
}

function LightboxZoomOut({
  className,
  children,
  onClick,
  ...props
}: LightboxButtonProps) {
  const lightbox = useLightbox()

  return (
    <LightboxButton
      data-slot="lightbox-zoom-out"
      className={className}
      aria-label="Zoom out"
      disabled={lightbox.transform.scale <= lightbox.minZoom}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) lightbox.zoomOut()
      }}
      {...props}
    >
      {children ?? <MinusIcon />}
    </LightboxButton>
  )
}

function LightboxZoomReset({
  className,
  children,
  onClick,
  ...props
}: LightboxButtonProps) {
  const lightbox = useLightbox()

  return (
    <LightboxButton
      data-slot="lightbox-zoom-reset"
      className={className}
      aria-label="Reset zoom"
      disabled={lightbox.transform.scale <= lightbox.minZoom}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) lightbox.resetTransform()
      }}
      {...props}
    >
      {children ?? <RotateCcwIcon />}
    </LightboxButton>
  )
}

export {
  Lightbox,
  LightboxCaption,
  LightboxClose,
  LightboxContent,
  LightboxCounter,
  LightboxImage,
  LightboxNext,
  LightboxOverlay,
  LightboxPortal,
  LightboxPrevious,
  LightboxSlide,
  LightboxTitle,
  LightboxToolbar,
  LightboxTrigger,
  LightboxViewport,
  LightboxZoomable,
  LightboxZoomIn,
  LightboxZoomOut,
  LightboxZoomReset,
  useLightbox,
}