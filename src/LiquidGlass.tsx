import { type ReactNode, useEffect, useId, useRef } from 'react'

type Spring = { value: number; velocity: number; target: number }

/** A curved perimeter bends backdrop pixels; the flat interior remains undistorted. */
function createLensMap(width: number, height: number) {
  const resolution = Math.min(1, 384 / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * resolution))
  canvas.height = Math.max(1, Math.round(height * resolution))
  const context = canvas.getContext('2d')
  if (!context) return null
  const pixels = context.createImageData(canvas.width, canvas.height)
  const radius = Math.min(24, width / 2, height / 2)
  const band = Math.min(18, height / 5)
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const px = (x + .5) / canvas.width * width - width / 2
      const py = (y + .5) / canvas.height * height - height / 2
      const qx = Math.abs(px) - (width / 2 - radius)
      const qy = Math.abs(py) - (height / 2 - radius)
      const cx = Math.max(qx, 0)
      const cy = Math.max(qy, 0)
      const cornerDistance = Math.hypot(cx, cy)
      const distance = -(cornerDistance + Math.min(Math.max(qx, qy), 0) - radius)
      const curvature = distance >= 0 && distance < band ? (1 - distance / band) ** 2 : 0
      const nx = cornerDistance > 0 ? cx / cornerDistance * Math.sign(px) : qx > qy ? Math.sign(px) : 0
      const ny = cornerDistance > 0 ? cy / cornerDistance * Math.sign(py) : qy >= qx ? Math.sign(py) : 0
      const i = (y * canvas.width + x) * 4
      pixels.data[i] = Math.round(128 - nx * curvature * 127)
      pixels.data[i + 1] = Math.round(128 - ny * curvature * 127)
      pixels.data[i + 2] = 128
      pixels.data[i + 3] = 255
    }
  }
  context.putImageData(pixels, 0, 0)
  return canvas.toDataURL()
}

/** Direct style updates keep pointer motion independent of application rendering. */
export function LiquidGlass({ as: Tag = 'section', className, children }: {
  as?: 'section' | 'div'
  className: string
  children: ReactNode
}) {
  const ref = useRef<HTMLElement | null>(null)
  const imageRef = useRef<SVGFEImageElement>(null)
  const lensRef = useRef<SVGFEDisplacementMapElement>(null)
  const filterId = `glass-lens-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
    const axes: Spring[] = Array.from({ length: 4 }, () => ({ value: 0, velocity: 0, target: 0 }))
    let frame = 0
    let previousTime = 0
    let bounds: DOMRect | null = null
    let hovering = false
    const compact = node.classList.contains('metric-card')
    const updateLens = () => {
      const map = createLensMap(node.offsetWidth, node.offsetHeight)
      if (!map || !imageRef.current) return
      imageRef.current.setAttribute('href', map)
      if (CSS.supports('backdrop-filter', `url("#${filterId}")`)) {
        node.style.setProperty('--liquid-lens', `blur(8px) url("#${filterId}")`)
      }
    }
    const resizeObserver = new ResizeObserver(updateLens)
    resizeObserver.observe(node)
    updateLens()

    const paint = () => {
      const [x, y, engagement, press] = axes.map((axis) => axis.value)
      const amount = Math.max(0, Math.min(1, engagement))
      const pressing = Math.max(0, Math.min(1, press))
      const size = 1 + engagement * (compact ? .012 : .003) - pressing * .014
      node.style.setProperty('--liquid-x', `${50 + x * 48}%`)
      node.style.setProperty('--liquid-y', `${50 + y * 48}%`)
      node.style.setProperty('--liquid-engagement', amount.toFixed(4))
      node.style.setProperty('--liquid-shadow-y', `${12 + amount * 6 - pressing * 4}px`)
      lensRef.current?.setAttribute('scale', String(motion.matches ? 8 : 8 + amount * 5 + pressing * 2))
      const resting = engagement === 0 && press === 0
      node.style.setProperty('--liquid-transform', motion.matches || resting ? 'none' :
        `scale(${size})`)
    }

    const tick = (time: number) => {
      frame = 0
      // Bounded substeps prevent a delayed frame from making the spring unstable.
      const elapsed = previousTime ? Math.min(32, time - previousTime) : 16
      previousTime = time
      let unsettled = false
      for (const axis of axes) {
        for (let step = 0; step < 2; step += 1) {
          const dt = elapsed / 32
          axis.velocity += (axis.target - axis.value) * .14 * dt
          axis.velocity *= Math.pow(.72, dt)
          axis.value += axis.velocity * dt
        }
        if (Math.abs(axis.target - axis.value) + Math.abs(axis.velocity) > .0008) unsettled = true
        else { axis.value = axis.target; axis.velocity = 0 }
      }
      paint()
      if (unsettled) frame = window.requestAnimationFrame(tick)
      else previousTime = 0
    }

    const animate = () => {
      if (motion.matches) {
        axes.forEach((axis) => { axis.value = axis.target; axis.velocity = 0 })
        paint()
      } else if (!frame) frame = window.requestAnimationFrame(tick)
    }
    const reset = () => {
      hovering = false
      bounds = null
      axes.forEach((axis) => { axis.target = 0 })
      animate()
    }
    const move = (event: PointerEvent) => {
      if (!finePointer.matches || event.pointerType === 'touch') return
      if (!bounds) bounds = node.getBoundingClientRect()
      hovering = true
      axes[0].target = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1))
      axes[1].target = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1))
      axes[2].target = 1
      animate()
    }
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || !hovering) return
      if (!(event.target instanceof Element) || !event.target.closest('button, a, input, select, textarea')) return
      axes[3].target = 1
      animate()
    }
    const up = () => {
      if (!axes[3].target && !axes[3].value) return
      axes[3].target = 0
      animate()
    }
    const focus = () => { axes[2].target = hovering ? 1 : .65; animate() }
    const blur = () => { if (!hovering) reset() }
    const visibility = () => { if (document.hidden) reset() }
    paint()
    node.addEventListener('pointerenter', move)
    node.addEventListener('pointermove', move)
    node.addEventListener('pointerleave', reset)
    node.addEventListener('pointercancel', reset)
    node.addEventListener('pointerdown', down)
    node.addEventListener('focusin', focus)
    node.addEventListener('focusout', blur)
    window.addEventListener('pointerup', up)
    window.addEventListener('blur', reset)
    window.addEventListener('scroll', reset, true)
    window.addEventListener('resize', reset)
    document.addEventListener('visibilitychange', visibility)
    motion.addEventListener('change', reset)
    finePointer.addEventListener('change', reset)
    return () => {
      window.cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      node.removeEventListener('pointerenter', move)
      node.removeEventListener('pointermove', move)
      node.removeEventListener('pointerleave', reset)
      node.removeEventListener('pointercancel', reset)
      node.removeEventListener('pointerdown', down)
      node.removeEventListener('focusin', focus)
      node.removeEventListener('focusout', blur)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('blur', reset)
      window.removeEventListener('scroll', reset, true)
      window.removeEventListener('resize', reset)
      document.removeEventListener('visibilitychange', visibility)
      motion.removeEventListener('change', reset)
      finePointer.removeEventListener('change', reset)
    }
  }, [filterId])

  return <Tag ref={(node) => { ref.current = node }} className={`${className} liquid-glass`}>
    <svg className="liquid-glass-filter" aria-hidden="true" focusable="false">
      <defs>
        <filter id={filterId} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feImage ref={imageRef} x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="lens-map" />
          <feDisplacementMap ref={lensRef} in="SourceGraphic" in2="lens-map" scale="8" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
    <span className="liquid-glass-material" aria-hidden="true">
      <span className="liquid-glass-optics" />
      <span className="liquid-glass-rim" />
    </span>
    {children}
  </Tag>
}
