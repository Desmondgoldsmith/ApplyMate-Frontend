/** Maps API tailor `sectionType` to CV Builder accordion / preview section ids. */
export function tailorSectionTypeToBuilderId(sectionType: string): string {
  const s = sectionType.trim().toLowerCase();
  if (!s) return 'summary';
  if (s === 'skills' || s === 'skill') return 'skills';
  if (s === 'experience' || s === 'work' || s === 'employment') return 'experience';
  if (s === 'education') return 'education';
  if (s === 'summary' || s === 'profile') return 'summary';
  if (s === 'personal' || s === 'contact' || s === 'header') return 'personal';
  if (s === 'projects' || s === 'project') return 'projects';
  if (s === 'certifications' || s === 'certification') return 'certifications';
  if (s === 'languages' || s === 'language') return 'languages';
  if (s === 'achievements' || s === 'achievement') return 'achievements';
  if (s === 'references' || s === 'reference') return 'references';
  return s;
}
