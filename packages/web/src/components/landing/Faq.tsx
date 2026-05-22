'use client';

import { motion } from 'framer-motion';

const faqs = [
  {
    q: 'Is ApplyMate just a form filler?',
    a: 'No. It analyzes the job, scores your fit, surfaces gaps, and helps you decide whether to apply — then automates the heavy lifting.',
  },
  {
    q: 'Which job boards are supported?',
    a: 'LinkedIn, Workday, Greenhouse, Lever, Indeed, Glassdoor, and more. Install once and use it across sites.',
  },
  {
    q: 'Do you store my CV?',
    a: 'Your CV is stored securely so ApplyMate can match you to roles and generate tailored answers — you control it from your account.',
  },
];

export function Faq() {
  return (
    <section id="faq" className="px-4 pb-[120px] sm:px-6 lg:px-[8%]">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{
          duration: 0.6,
          ease: [0.21, 0.47, 0.32, 0.98] as const,
        }}
        className="mx-auto max-w-[800px]"
      >
        <p className="text-center text-[11px] font-bold uppercase tracking-[3px] text-[#00C9B1]">
          FAQ
        </p>
        <h2 className="mt-4 text-center text-[32px] font-extrabold tracking-[-1px] text-white sm:text-[38px]">
          Answers before you install
        </h2>
        <div className="mt-12 space-y-4">
          {faqs.map((item) => (
            <div
              key={item.q}
              className="rounded-[20px] border border-[rgba(0,201,177,0.12)] bg-[rgba(255,255,255,0.02)] p-6"
            >
              <h3 className="text-[16px] font-bold text-white">{item.q}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-[rgba(255,255,255,0.5)]">
                {item.a}
              </p>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
