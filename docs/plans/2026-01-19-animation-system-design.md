# Animation System Design - Agentic Flow

**Date:** 2026-01-19  
**Status:** Approved  
**Focus:** Visual polish & animations  
**Style:** Snappy & responsive (spring physics, quick micro-animations)

---

## Overview

Add life to the terminal-first UI through purposeful animations. Focus on output streaming and status feedback - the two areas that feel most "dead" currently.

**Constraints:**
- Weak server = no heavy computation, UI-only changes
- Use existing Framer Motion (already installed)
- Component-level approach (no global animation context)

---

## 1. Output Streaming Animations

### Block Entry Animation
- New blocks slide up from below with spring physics
- Config: `spring: { stiffness: 500, damping: 30 }`
- Slight scale from 0.98 → 1.0 for "pop" feel
- Duration: ~200ms total

### Content Reveal
- Streaming content: fast typewriter effect (visible, not slow)
- Completed content: fade-in with slight upward motion
- Code blocks: horizontal gradient sweep (scan line) on appear

### Markdown Section Stagger
- Headers, paragraphs, lists animate in sequence
- Delay between elements: 30-50ms
- Fast enough to feel instant, slow enough to notice

### Files to Modify
- `OutputBlock.tsx` - main entry animation
- Create `AnimatedMarkdown.tsx` - staggered markdown wrapper

---

## 2. Status Change Animations

### Thinking/Processing State
- Pulsing glow on active role button (emerald/violet based on role)
- StatusPill "breathing" scale: 1.0 → 1.02 → 1.0 (1.5s loop)
- Three-dot loader with staggered bounce

### Success State
- Quick "pop" scale: 1.0 → 1.1 → 1.0 with spring
- Checkmark draws itself (SVG path animation, 150ms)
- Brief green flash on output block border

### Error State
- Horizontal shake (3 shakes, 200ms total)
- Red pulse on border that fades
- Error icon with subtle rotation on appear

### Model Switching
- Current model fades out with scale down
- New model fades in with scale up
- Status dot color transitions smoothly

### Files to Modify
- `StatusPill.tsx` - breathing/pulse animations
- `OutputBlock.tsx` - success pop, error shake
- `ModelSelector.tsx` - status dot transitions

---

## 3. Quick Wins & Polish

### Header & Navigation
- Role selector: active indicator slides between buttons (layoutId)
- Token counter: numbers animate on change, dropdown slides with spring
- Command palette: backdrop fade (100ms), modal scale 0.95→1.0, results stagger (20ms)

### Sidebar
- Execution Plan: checkmark draws on complete, progress bar easeOut fill
- Session Timeline: active role pulses, completed roles get shine effect

### Micro-interactions
- Buttons: scale 0.97 on press, spring back on release
- Hover states: 100ms fade transitions
- Focus rings: animate outward (ripple effect)

---

## Implementation Priority

| Priority | Component | Impact |
|----------|-----------|--------|
| 1 | OutputBlock entry + content reveal | Highest - main content area |
| 2 | StatusPill thinking/success/error | High - core feedback |
| 3 | Role selector sliding indicator | Medium - navigation feel |
| 4 | Token counter animations | Medium - polish |
| 5 | Command palette animations | Low - used less often |
| 6 | Sidebar animations | Low - secondary UI |

---

## Animation Configs (Reference)

```tsx
// Snappy spring for entries
const snapSpring = { type: "spring", stiffness: 500, damping: 30 };

// Gentle spring for micro-interactions  
const gentleSpring = { type: "spring", stiffness: 300, damping: 25 };

// Quick fade
const quickFade = { duration: 0.1 };

// Stagger children
const staggerChildren = { staggerChildren: 0.03 };
```

---

## Success Criteria

- [ ] Output blocks feel "alive" when appearing
- [ ] Clear visual distinction between thinking/success/error states
- [ ] No animation longer than 300ms (stays snappy)
- [ ] Animations enhance, never block interaction
