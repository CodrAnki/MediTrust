const COPY = {
  privacy: {
    title: 'Privacy',
    body: [
      ['What is stored', 'Your account details (name, email, password hash) and, for each verification, the uploaded image(s), the extracted text and the resulting assessment, so you can review your history.'],
      ['Image processing', 'Uploaded medicine photos are processed by MediTrust. They are stored with your verification history so you can review past results.'],
      ['Who can see it', 'Your verification results are visible to you. Administrators can view verification records to maintain the reference data; their actions are audit-logged.'],
      ['Your choices', 'Contact us to ask about your data. This notice is a plain-language summary and should be reviewed by your organisation before production use.'],
    ],
  },
  terms: {
    title: 'Terms',
    body: [
      ['Nature of the service', 'MediTrust provides a technology-assisted verification assessment based on available evidence. It does not guarantee that a medicine is genuine or counterfeit.'],
      ['Not medical or regulatory advice', 'Results must not replace professional medical advice, laboratory testing or official regulatory verification. If in doubt, consult a pharmacist or the manufacturer.'],
      ['Acceptable use', 'Do not upload content you do not have the right to use, and do not attempt to disrupt or probe the service or its administrative areas.'],
      ['Changes', 'These terms are a summary and should be reviewed by your organisation before production use.'],
    ],
  },
};

export default function Legal({ kind }) {
  const c = COPY[kind];
  return (
    <section className="mx-auto max-w-3xl px-5 py-14 sm:px-6 sm:py-20">
      <h1 className="font-[var(--font-display)] text-[34px] font-semibold tracking-tight text-[var(--color-ink)]">{c.title}</h1>
      <div className="mt-6 flex flex-col gap-5">
        {c.body.map(([h, t]) => (
          <div key={h}><h2 className="text-[16px] font-semibold text-[var(--color-ink)]">{h}</h2><p className="mt-1.5 text-[14.5px] leading-relaxed text-[var(--color-ink-soft)]">{t}</p></div>
        ))}
      </div>
    </section>
  );
}
