import { normalizeBullets, type CVBuilderData } from '@/lib/cvBuilder';

export type CvAssistantSuggestion = {
  label: string;
  /** Full instruction inserted into the assistant text field */
  prompt: string;
};

export type CvAssistantSuggestionBundle = {
  suggestions: CvAssistantSuggestion[];
  /** Short guidance when the CV lacks signals needed for smart generation */
  hint?: string;
};

function summaryHasContent(d: CVBuilderData): boolean {
  return String(d.summary?.text ?? '').trim().length >= 18;
}

function hasUsableExperience(d: CVBuilderData): boolean {
  const items = d.experience?.items;
  if (!Array.isArray(items)) return false;
  return items.some((j) => {
    const bullets = normalizeBullets(j?.bullets);
    return (
      String(j?.title ?? '').trim().length > 1 ||
      String(j?.company ?? '').trim().length > 1 ||
      bullets.some((b) => b.trim().length > 8)
    );
  });
}

function hasUsableSkills(d: CVBuilderData): boolean {
  const cats = d.skills?.categories;
  if (!Array.isArray(cats)) return false;
  return cats.some(
    (c) =>
      String(c?.name ?? '').trim().length > 1 ||
      (Array.isArray(c?.skills) && c.skills.some((s) => String(s ?? '').trim().length > 1)),
  );
}

function hasUsableEducation(d: CVBuilderData): boolean {
  const items = d.education?.items;
  if (!Array.isArray(items)) return false;
  return items.some(
    (e) =>
      String(e?.school ?? '').trim().length > 1 ||
      String(e?.degree ?? '').trim().length > 1 ||
      String(e?.field ?? '').trim().length > 1,
  );
}

function experienceHasAnyRole(d: CVBuilderData): boolean {
  const items = d.experience?.items;
  if (!Array.isArray(items)) return false;
  return items.some(
    (j) =>
      String(j?.title ?? '').trim().length > 0 ||
      String(j?.company ?? '').trim().length > 0 ||
      normalizeBullets(j?.bullets).length > 0,
  );
}

function projectsHaveContent(d: CVBuilderData): boolean {
  const projects = d.projects;
  if (!Array.isArray(projects)) return false;
  return projects.some(
    (p) =>
      String(p?.name ?? '').trim().length > 1 ||
      String(p?.description ?? '').trim().length > 8 ||
      (p?.bullets && String(p.bullets).trim().length > 8),
  );
}

function certificationsHaveRows(d: CVBuilderData): boolean {
  const rows = d.certifications;
  if (!Array.isArray(rows)) return false;
  return rows.some((c) => String(c?.name ?? '').trim().length > 1 || String(c?.issuer ?? '').trim().length > 1);
}

function languagesHaveRows(d: CVBuilderData): boolean {
  const rows = d.languages;
  if (!Array.isArray(rows)) return false;
  return rows.some((l) => String(l?.language ?? '').trim().length > 1);
}

function achievementsHaveRows(d: CVBuilderData): boolean {
  const rows = d.achievements;
  if (!Array.isArray(rows)) return false;
  return rows.some((a) => String(a?.title ?? '').trim().length > 1 || String(a?.detail ?? '').trim().length > 8);
}

function referencesHaveRows(d: CVBuilderData): boolean {
  const rows = d.references;
  if (!Array.isArray(rows)) return false;
  return rows.some((r) => String(r?.name ?? '').trim().length > 1 || String(r?.company ?? '').trim().length > 1);
}

function customLegacyHasBody(d: CVBuilderData): boolean {
  const sections = d.customSections;
  if (!Array.isArray(sections)) return false;
  return sections.some((s) => String(s?.title ?? '').trim().length > 0 || String(s?.body ?? '').trim().length > 8);
}

function parsedCustomHasText(d: CVBuilderData): boolean {
  const blocks = d.parsedCustomSections;
  if (!Array.isArray(blocks)) return false;
  return blocks.some((s) =>
    (Array.isArray(s?.items) ? s.items : []).some(
      (i) =>
        String(i?.text ?? '').trim().length > 8 ||
        (Array.isArray(i?.subItems) && i.subItems.some((x) => String(x ?? '').trim().length > 4)),
    ),
  );
}

const IMPROVE = 'Improve writing and clarity for this section using my existing CV content.';
const RECRUITER = 'Review this section as a recruiter would: flag weaknesses and propose a stronger rewrite.';
const ATS =
  'Improve structure and keywords for readability and common resume-screening tools (heuristic suggestions only).';

export function getCvSectionAssistantSuggestions(
  sectionId: string,
  data: CVBuilderData,
): CvAssistantSuggestionBundle {
  let key = sectionId.startsWith('parsed-') ? 'parsed-custom' : sectionId;
  if (sectionId.startsWith('parsed-')) {
    const raw = sectionId.slice('parsed-'.length);
    const block = (data.parsedCustomSections ?? []).find((b) => b.sectionId === raw);
    const st = (block?.sectionType ?? '').toLowerCase();
    if (/volunteer/.test(st)) key = 'volunteering';
    else if (/interest|hobby/.test(st)) key = 'interests';
  }

  switch (key) {
    case 'summary': {
      if (!summaryHasContent(data)) {
        const basis = hasUsableExperience(data) || hasUsableSkills(data) || hasUsableEducation(data);
        if (basis) {
          return {
            suggestions: [
              {
                label: 'Generate from my CV',
                prompt:
                  'Write a concise professional summary (3–4 sentences, first person) for my CV using my experience, education, and skills already in this document.',
              },
              {
                label: 'Role-targeted summary',
                prompt:
                  'Draft a tailored CV summary for my target role, grounded in the roles, skills, and education already in this CV.',
              },
              {
                label: 'Shorter opener',
                prompt:
                  'Generate a tight 2-sentence summary that highlights my strongest proof points from the rest of this CV.',
              },
            ],
          };
        }
        return {
          hint: 'Add experience, skills, or education first—or describe your background in the box below so the assistant can draft a summary.',
          suggestions: [
            {
              label: 'Generate from what I type',
              prompt:
                'I will describe my work history, skills, and goals in my own words in the next message—turn that into a polished CV summary.',
            },
            {
              label: 'Starter template',
              prompt:
                  'Suggest 3 alternative summary openings I can adapt; I have not filled other sections yet.',
            },
          ],
        };
      }
      return {
        suggestions: [
          { label: 'Improve writing', prompt: `For the Summary section: ${IMPROVE}` },
          { label: 'Recruiter review', prompt: `For the Summary section: ${RECRUITER}` },
          { label: 'Add metrics & impact', prompt: 'Rewrite my summary to emphasize measurable impact while staying truthful to the CV.' },
          { label: 'Shorten', prompt: 'Shorten my summary to two crisp sentences without losing key strengths.' },
        ],
      };
    }
    case 'experience': {
      if (!experienceHasAnyRole(data)) {
        return {
          hint: 'Add a role (title, company, dates) or paste achievements below so the assistant can help.',
          suggestions: [
            {
              label: 'Outline my first role',
              prompt:
                'I will paste a rough job description or bullet notes below—turn them into a strong first experience entry with 3–5 achievement bullets.',
            },
            {
              label: 'Suggest bullet formula',
              prompt: 'Give me a checklist and 5 example achievement bullets for my industry until I add real roles.',
            },
          ],
        };
      }
      return {
        suggestions: [
          {
            label: 'Stronger bullets',
            prompt:
              'Improve the achievement bullets in my current experience section: more impact, numbers where credible, active verbs.',
          },
          { label: 'Improve writing', prompt: `For the Experience section: ${IMPROVE}` },
          { label: 'Recruiter review', prompt: `For the Experience section: ${RECRUITER}` },
          { label: 'Formatting polish', prompt: `For the Experience section: ${ATS}` },
        ],
      };
    }
    case 'education': {
      if (!hasUsableEducation(data)) {
        return {
          hint: 'Fill at least one school or degree—or describe your education in the box.',
          suggestions: [
            {
              label: 'Format from notes',
              prompt:
                'I will describe my degrees and institutions in plain text below—format them into clean education entries for my CV.',
            },
          ],
        };
      }
      return {
        suggestions: [
          { label: 'Improve writing', prompt: `For the Education section: ${IMPROVE}` },
          { label: 'Recruiter review', prompt: `For the Education section: ${RECRUITER}` },
          {
            label: 'Highlight relevance',
            prompt: 'Tighten my education entries to emphasize relevance for employability without fluff.',
          },
        ],
      };
    }
    case 'skills': {
      if (!hasUsableSkills(data)) {
        return {
          hint: 'Add a few skills—or list them in the box so we can group and word them professionally.',
          suggestions: [
            {
              label: 'Group from a list',
              prompt:
                'I will paste a comma-separated list of my skills below—organize them into sensible categories for my CV.',
            },
          ],
        };
      }
      return {
        suggestions: [
          {
            label: 'Tailor & group',
            prompt:
              'Reorganize and lightly reword my skills section for clarity: group by theme, remove duplicates, keep honest proficiency.',
          },
          { label: 'Improve writing', prompt: `For the Skills section: ${IMPROVE}` },
          { label: 'Recruiter review', prompt: `For the Skills section: ${RECRUITER}` },
        ],
      };
    }
    case 'projects': {
      if (!projectsHaveContent(data)) {
        return {
          hint: 'Add a project name or paste details below.',
          suggestions: [
            {
              label: 'Draft from description',
              prompt:
                'I will describe a project in rough notes below—turn it into a polished CV project entry with impact bullets.',
            },
          ],
        };
      }
      return {
        suggestions: [
          {
            label: 'Impact bullets',
            prompt: 'Improve my Projects section: sharper outcomes, technologies, and measurable results where credible.',
          },
          { label: 'Improve writing', prompt: `For the Projects section: ${IMPROVE}` },
          { label: 'Recruiter review', prompt: `For the Projects section: ${RECRUITER}` },
        ],
      };
    }
    case 'certifications': {
      if (!certificationsHaveRows(data)) {
        return {
          hint: 'Add certifications or paste names/issuers below.',
          suggestions: [
            {
              label: 'Format list',
              prompt:
                'I will paste my certifications as a plain list below—format them consistently for my CV certifications section.',
            },
          ],
        };
      }
      return {
        suggestions: [
          { label: 'Improve writing', prompt: `For the Certifications section: ${IMPROVE}` },
          { label: 'Recruiter review', prompt: `For the Certifications section: ${RECRUITER}` },
        ],
      };
    }
    case 'languages': {
      if (!languagesHaveRows(data)) {
        return {
          hint: 'Add languages or list them below with level.',
          suggestions: [
            {
              label: 'Format proficiency',
              prompt:
                'I will list languages and my proficiency in plain text—format into a clean languages section for my CV.',
            },
          ],
        };
      }
      return {
        suggestions: [
          { label: 'Improve writing', prompt: `For the Languages section: ${IMPROVE}` },
          { label: 'Recruiter review', prompt: `For the Languages section: ${RECRUITER}` },
        ],
      };
    }
    case 'achievements': {
      if (!achievementsHaveRows(data)) {
        return {
          hint: 'Add achievements or describe them below.',
          suggestions: [
            {
              label: 'Draft entries',
              prompt:
                'I will paste rough achievement notes below—turn them into concise achievement entries suitable for my CV.',
            },
          ],
        };
      }
      return {
        suggestions: [
          {
            label: 'Sharpen impact',
            prompt: 'Rewrite my achievements to be punchier and more credible, keeping facts aligned with the rest of my CV.',
          },
          { label: 'Improve writing', prompt: `For the Achievements section: ${IMPROVE}` },
          { label: 'Recruiter review', prompt: `For the Achievements section: ${RECRUITER}` },
        ],
      };
    }
    case 'references': {
      if (!referencesHaveRows(data)) {
        return {
          hint: 'Add reference contacts or say you prefer “available on request”.',
          suggestions: [
            {
              label: '“On request” wording',
              prompt:
                'Suggest concise CV wording for references (available on request) appropriate for this section.',
            },
          ],
        };
      }
      return {
        suggestions: [
          { label: 'Improve writing', prompt: `For the References section: ${IMPROVE}` },
          { label: 'Recruiter review', prompt: `For the References section: ${RECRUITER}` },
        ],
      };
    }
    case 'personal': {
      const p = data.personal ?? { name: '', email: '', headline: '' };
      const thin =
        String(p.name ?? '').trim().length < 2 ||
        (String(p.headline ?? '').trim().length < 4 && String(p.email ?? '').trim().length < 4);
      if (thin) {
        return {
          hint: 'Fill your name and at least one contact line for stronger suggestions.',
          suggestions: [
            {
              label: 'Professional headline',
              prompt:
                'Suggest 3 concise professional headline options for the top of my CV based on what is already filled in (title, skills, experience).',
            },
            {
              label: 'Polish contact block',
              prompt: 'Review my header/contact area for tone, clarity, and redundancy—propose minimal edits only.',
            },
          ],
        };
      }
      return {
        suggestions: [
          {
            label: 'Headline options',
            prompt:
              'Propose 3 stronger headline variants for my CV header using my current headline, skills, and roles—keep them honest.',
          },
          { label: 'Improve writing', prompt: `For the Personal / header section: ${IMPROVE}` },
          { label: 'Recruiter review', prompt: `For the Personal / header section: ${RECRUITER}` },
        ],
      };
    }
    case 'custom-legacy': {
      if (!customLegacyHasBody(data)) {
        return {
          hint: 'Add custom section content—or paste a draft below.',
          suggestions: [
            {
              label: 'Structure draft',
              prompt:
                'I will paste rough content for my custom CV section below—structure and polish it for readability.',
            },
          ],
        };
      }
      return {
        suggestions: [
          { label: 'Improve writing', prompt: `For my custom CV section: ${IMPROVE}` },
          { label: 'Recruiter review', prompt: `For my custom CV section: ${RECRUITER}` },
          { label: 'Formatting polish', prompt: `For my custom CV section: ${ATS}` },
        ],
      };
    }
    case 'volunteering': {
      const raw = sectionId.startsWith('parsed-') ? sectionId.slice('parsed-'.length) : '';
      const block = (data.parsedCustomSections ?? []).find((b) => b.sectionId === raw);
      const hasRows = (block?.items ?? []).some(
        (i) =>
          String(i?.text ?? '').trim().length > 1 ||
          (Array.isArray(i?.subItems) && i.subItems.some((s) => String(s ?? '').trim().length > 4)),
      );
      if (!hasRows) {
        return {
          hint: 'Add volunteering entries—or describe what you did below.',
          suggestions: [
            {
              label: 'Draft from notes',
              prompt:
                'I will paste rough volunteering notes below—turn them into concise CV entries with impact bullets.',
            },
          ],
        };
      }
      return {
        suggestions: [
          {
            label: 'Stronger impact bullets',
            prompt:
              'Improve my volunteering section: clearer impact, dates where relevant, and active verbs—stay truthful.',
          },
          { label: 'Improve writing', prompt: `For my Volunteering section: ${IMPROVE}` },
          { label: 'Recruiter review', prompt: `For my Volunteering section: ${RECRUITER}` },
        ],
      };
    }
    case 'interests': {
      const raw = sectionId.startsWith('parsed-') ? sectionId.slice('parsed-'.length) : '';
      const block = (data.parsedCustomSections ?? []).find((b) => b.sectionId === raw);
      const hasRows = (block?.items ?? []).some(
        (i) =>
          String(i?.text ?? '').trim().length > 1 ||
          (Array.isArray(i?.subItems) && i.subItems.some((s) => String(s ?? '').trim().length > 2)),
      );
      if (!hasRows) {
        return {
          hint: 'List interests or hobbies—or paste a short paragraph below.',
          suggestions: [
            {
              label: 'Polish my list',
              prompt:
                'I will list my interests and hobbies below—format them professionally for my CV interests section.',
            },
          ],
        };
      }
      return {
        suggestions: [
          {
            label: 'Tighter wording',
            prompt:
              'Tighten my interests/hobbies section: concise, professional tone, no clichés—keep it authentic.',
          },
          { label: 'Improve writing', prompt: `For my Interests section: ${IMPROVE}` },
          { label: 'Recruiter review', prompt: `For my Interests section: ${RECRUITER}` },
        ],
      };
    }
    case 'parsed-custom': {
      if (!parsedCustomHasText(data)) {
        return {
          hint: 'Add text to this section—or paste content you want shaped for your CV.',
          suggestions: [
            {
              label: 'Polish pasted content',
              prompt:
                'I will paste content for this custom section below—clean it up and format it consistently with the rest of my CV.',
            },
          ],
        };
      }
      return {
        suggestions: [
          { label: 'Improve writing', prompt: `For this custom section (${sectionId}): ${IMPROVE}` },
          { label: 'Recruiter review', prompt: `For this custom section: ${RECRUITER}` },
          { label: 'Formatting polish', prompt: `For this custom section: ${ATS}` },
        ],
      };
    }
    default:
      return {
        suggestions: [
          { label: 'Improve writing', prompt: IMPROVE },
          { label: 'Recruiter review', prompt: RECRUITER },
          { label: 'Inspire me', prompt: 'Suggest 3 concrete improvements for this part of my CV based on the current content.' },
        ],
      };
  }
}
