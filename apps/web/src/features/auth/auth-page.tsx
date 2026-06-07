import { Link, Navigate, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "../../components/ui/card";
import { InlineAlert } from "../../components/ui/inline-alert";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Skeleton } from "../../components/ui/skeleton";
import { getUserFacingApiError } from "../../lib/api-errors";
import { LanguageSwitch } from "../../components/layout/language-switch";
import { ThemeSwitch } from "../../components/layout/theme-switch";
import {
  useDemoLoginMutation,
  useLoginMutation,
  useRegisterMutation,
  useSession
} from "./auth-queries";

type AuthMode = "login" | "register";

type FormState = {
  name: string;
  email: string;
  password: string;
};

const initialFormState: FormState = {
  name: "",
  email: "",
  password: ""
};

function validateForm(mode: AuthMode, form: FormState, t: (key: string) => string) {
  if (mode === "register" && !form.name.trim()) {
    return t("validation.required");
  }

  if (!form.email.includes("@")) {
    return t("validation.email");
  }

  if (form.password.length < 8) {
    return t("validation.passwordLength");
  }

  return null;
}

export function AuthPage({ mode }: { mode: AuthMode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const session = useSession();
  const login = useLoginMutation();
  const register = useRegisterMutation();
  const demo = useDemoLoginMutation();
  const [form, setForm] = React.useState<FormState>(initialFormState);
  const [formError, setFormError] = React.useState<string | null>(null);
  const mutation = mode === "login" ? login : register;
  const apiError = mutation.error ?? demo.error;

  if (session.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4">
        <Skeleton className="h-80 w-full max-w-md" />
      </main>
    );
  }

  if (session.data) {
    return <Navigate to="/app" replace />;
  }

  const updateField =
    (field: keyof FormState) =>
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
      setFormError(null);
    };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateForm(mode, form, t);

    if (validationError) {
      setFormError(validationError);
      return;
    }

    if (mode === "login") {
      login.mutate(
        { email: form.email, password: form.password },
        { onSuccess: () => void navigate({ to: "/app/projects" }) }
      );
      return;
    }

    register.mutate(
      { name: form.name, email: form.email, password: form.password },
      { onSuccess: () => void navigate({ to: "/app/projects" }) }
    );
  };

  const handleDemo = () => {
    setFormError(null);
    demo.mutate(undefined, {
      onSuccess: (session) =>
        void navigate({ to: "/app/boards/$boardId", params: { boardId: session.demo.boardId } })
    });
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Link className="text-sm font-semibold" to="/">
            {t("app.name")}
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <LanguageSwitch />
            <ThemeSwitch />
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center py-10">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>{t(`auth.${mode}.title`)}</CardTitle>
              <CardDescription>{t(`auth.${mode}.description`)}</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                {mode === "register" ? (
                  <div className="space-y-2">
                    <Label htmlFor="name">{t("auth.fields.name")}</Label>
                    <Input
                      autoComplete="name"
                      id="name"
                      onChange={updateField("name")}
                      placeholder={t("auth.fields.namePlaceholder")}
                      value={form.name}
                    />
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="email">{t("auth.fields.email")}</Label>
                  <Input
                    autoComplete="email"
                    id="email"
                    inputMode="email"
                    onChange={updateField("email")}
                    placeholder={t("auth.fields.emailPlaceholder")}
                    type="email"
                    value={form.email}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t("auth.fields.password")}</Label>
                  <Input
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    id="password"
                    onChange={updateField("password")}
                    placeholder={t("auth.fields.passwordPlaceholder")}
                    type="password"
                    value={form.password}
                  />
                </div>

                {formError ? <InlineAlert>{formError}</InlineAlert> : null}
                {apiError ? <InlineAlert>{getUserFacingApiError(apiError, t)}</InlineAlert> : null}

                <Button className="w-full" disabled={mutation.isPending} type="submit">
                  {t(`auth.${mode}.submit`)}
                </Button>
              </form>

              <div className="my-5 h-px bg-border" />

              <div className="space-y-3">
                <Button
                  className="w-full"
                  disabled={demo.isPending}
                  onClick={handleDemo}
                  type="button"
                  variant="outline"
                >
                  {t("auth.demo.button")}
                </Button>
                <p className="text-center text-xs leading-5 text-muted-foreground">
                  {t("auth.demo.description")}
                </p>
              </div>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {t(`auth.${mode}.switchPrompt`)}{" "}
                <Link
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                  to={mode === "login" ? "/register" : "/login"}
                >
                  {t(`auth.${mode}.switchLink`)}
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
