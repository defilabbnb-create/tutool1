type HeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle: string;
};

export function Header({ eyebrow, title, subtitle }: HeaderProps) {
  return (
    <header className="header">
      {eyebrow ? <p className="header-eyebrow">{eyebrow}</p> : null}
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  );
}
