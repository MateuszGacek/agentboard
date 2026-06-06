import { useTranslation } from "react-i18next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "../../components/ui/card";

type PlaceholderPageProps = {
  titleKey: string;
  descriptionKey: string;
};

export function PlaceholderPage({ titleKey, descriptionKey }: PlaceholderPageProps) {
  const { t } = useTranslation();

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>{t(titleKey)}</CardTitle>
        <CardDescription>{t(descriptionKey)}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground">
          {t("states.empty")}
        </div>
      </CardContent>
    </Card>
  );
}
