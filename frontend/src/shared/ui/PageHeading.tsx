interface Props {
  title: string;
  description: string;
}

export function PageHeading({ title, description }: Props) {
  return (
    <div className="mb-7">
      <h1 id="page-title" tabIndex={-1} className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">{description}</p>
    </div>
  );
}
