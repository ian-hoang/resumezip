"use client"

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { MoreIcon, RowAction } from "./RowActions"

export interface MenuItem {
  label: string
  icon: ReactNode
  onSelect: () => void
  danger?: boolean
}

/** A menu's panel: glass, grown out of its button (dashboard.css). Its items are rounded to fit inside it, as MENU_ITEM. */
export const MENU_PANEL = "menu-panel glass glass-frost absolute z-30 flex min-w-[168px] flex-col gap-0.5 rounded-panel p-1.5"
export const MENU_ITEM =
  "row-action flex h-10 items-center gap-2.5 rounded-row px-3.5 text-left text-sm transition-colors hover:bg-ink/[0.06] focus-visible:bg-ink/[0.06] focus-visible:outline-none"

const itemsIn = (menu: HTMLElement | null) => [...(menu?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])]

/**
 * What a button with a small menu needs: arrow keys move through the menu,
 * Escape or Tab closes it, and clicking anywhere else closes it too. It
 * opens on the item that's chosen, if one is.
 */
export function useMenu() {
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    // It opens beside its button, which is on screen.
    const items = itemsIn(menu.current)
    ;(items.find((item) => item.getAttribute("aria-checked") === "true") ?? items[0])?.focus({ preventScroll: true })
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!menu.current?.contains(target) && !button.current?.contains(target)) setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [open])

  const close = (refocus: boolean) => {
    setOpen(false)
    if (refocus) button.current?.focus()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const options = itemsIn(menu.current)
    const at = options.indexOf(document.activeElement as HTMLElement)
    const move = (to: number) => {
      event.preventDefault()
      options[(to + options.length) % options.length]?.focus()
    }
    if (event.key === "ArrowDown") move(at + 1)
    else if (event.key === "ArrowUp") move(at - 1)
    else if (event.key === "Home") move(0)
    else if (event.key === "End") move(options.length - 1)
    else if (event.key === "Escape") {
      event.preventDefault()
      // Only the menu closes, not a dialog it might be in.
      event.stopPropagation()
      close(true)
    } else if (event.key === "Tab") close(false)
  }

  return { open, setOpen, button, menu, close, onKeyDown }
}

interface MoreMenuProps {
  /** What the button's called, as "More for “Ada”". Its tip says "More". */
  label: string
  items: MenuItem[]
  [data: `data-${string}`]: string
}

/**
 * A round More button with a small menu of the actions that don't fit beside
 * it. Choosing an item closes the menu.
 */
export default function MoreMenu({ label, items, ...data }: MoreMenuProps) {
  const { open, setOpen, button, menu, close, onKeyDown } = useMenu()
  const id = useId()

  return (
    <div className="relative">
      <RowAction
        ref={button}
        label={label}
        tip="More"
        tipAtEnd
        menuOpen={open}
        className="more-button"
        onClick={() => setOpen((open) => !open)}
        {...data}
      >
        <MoreIcon />
      </RowAction>
      {open && (
        <div
          ref={menu}
          id={id}
          role="menu"
          aria-label={label}
          onKeyDown={onKeyDown}
          className={`${MENU_PANEL} more-menu bottom-full right-0 mb-2`}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                close(false)
                item.onSelect()
              }}
              className={`${MENU_ITEM} ${item.danger ? "text-alert" : "text-ink"}`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
