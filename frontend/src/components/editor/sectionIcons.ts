import {
  AlignLeft,
  Award,
  BookOpen,
  Briefcase,
  GraduationCap,
  Hammer,
  HandHeart,
  List,
  User,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react"
import type { ExtraKind } from "@/lib/resumeSections"
import type { SectionName } from "./sections"

/** Each section's icon, in the section list and in Add section. */
export const SECTION_ICONS: Record<SectionName, LucideIcon> = {
  Education: GraduationCap,
  Work: Briefcase,
  Skills: Zap,
  Projects: Hammer,
  Publications: BookOpen,
  Volunteership: HandHeart,
  Leadership: Users,
  Awards: Award,
}

/** A section the person added, by what it holds: text, or bullets. */
export const EXTRA_ICONS: Record<ExtraKind, LucideIcon> = { text: AlignLeft, list: List }

export const PROFILE_ICON = User
