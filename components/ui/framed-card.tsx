import { Card, CardContent, CardHeader, CardTitle } from "./card";

export function FramedCard({
  title,
  tools,
  className,
  bodyClassName,
  children,
}: {
  title?: React.ReactNode;
  tools?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={className}>
      {title || tools ? (
        <CardHeader className="flex-row items-center justify-between gap-3">
          {title ? <CardTitle>{title}</CardTitle> : <span />}
          {tools ? <div className="flex flex-wrap items-center gap-2">{tools}</div> : null}
        </CardHeader>
      ) : null}
      <CardContent className={bodyClassName}>{children}</CardContent>
    </Card>
  );
}
