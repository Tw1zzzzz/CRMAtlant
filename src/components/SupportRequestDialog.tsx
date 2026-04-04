import React, { FormEvent, useEffect, useState } from "react";
import { MessageCircle, UserRound } from "lucide-react";
import { toast } from "sonner";
import { submitSupportRequest, type SupportRequestPayload } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type SupportCategory = SupportRequestPayload["category"];
type SupportTriggerVariant = "inline" | "floating";

interface SupportFormState {
  name: string;
  email: string;
  category: SupportCategory;
  subject: string;
  message: string;
}

interface SupportRequestDialogProps {
  variant?: SupportTriggerVariant;
}

const supportCategoryLabels: Record<SupportCategory, string> = {
  access: "Вход и доступ",
  bug: "Ошибка в системе",
  billing: "Оплата и подписка",
  integration: "Интеграции и данные",
  other: "Другое",
};

const emptySupportForm: SupportFormState = {
  name: "",
  email: "",
  category: "access",
  subject: "",
  message: "",
};

const SupportRequestDialog: React.FC<SupportRequestDialogProps> = ({ variant = "inline" }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [supportForm, setSupportForm] = useState<SupportFormState>(emptySupportForm);

  useEffect(() => {
    if (!user) {
      return;
    }

    setSupportForm((prev) => ({
      ...prev,
      name: prev.name || user.name || "",
      email: prev.email || user.email || "",
    }));
  }, [user]);

  const updateSupportField = <K extends keyof SupportFormState>(field: K, value: SupportFormState[K]): void => {
    setSupportForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSupportSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    const trimmedEmail = supportForm.email.trim();
    const trimmedSubject = supportForm.subject.trim();
    const trimmedMessage = supportForm.message.trim();

    if (!trimmedEmail || !trimmedSubject || !trimmedMessage) {
      toast.error("Заполните email, тему и описание проблемы");
      return;
    }

    if (trimmedMessage.length < 10) {
      toast.error("Опишите проблему чуть подробнее");
      return;
    }

    try {
      setSubmitting(true);
      await submitSupportRequest({
        name: supportForm.name.trim() || undefined,
        email: trimmedEmail,
        category: supportForm.category,
        subject: trimmedSubject,
        message: trimmedMessage,
        pageUrl: window.location.href,
        userAgent: window.navigator.userAgent,
      });

      toast.success("Заявка отправлена. Ответ придёт на вашу почту.");
      setSupportForm((prev) => ({
        ...emptySupportForm,
        name: prev.name,
        email: trimmedEmail,
      }));
      setOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось отправить обращение";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "floating" ? (
          <Button
            type="button"
            size="icon"
            aria-label="Связаться с поддержкой"
            className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full text-white shadow-[0_16px_40px_rgba(30,127,247,0.38)] transition hover:scale-[1.03]"
            style={{ backgroundColor: "#1e7ff7" }}
          >
            <UserRound className="h-6 w-6" />
          </Button>
        ) : (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm text-slate-300 transition hover:text-white"
          >
            <MessageCircle className="h-4 w-4 text-sky-300" />
            <span>
              Нужна помощь? <span className="text-sky-300 underline underline-offset-4">Связаться с техподдержкой</span>
            </span>
          </button>
        )}
      </DialogTrigger>

      <DialogContent className="border-white/10 bg-slate-950 text-white sm:max-w-xl">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-xl text-white">Связаться с техподдержкой</DialogTitle>
          <DialogDescription className="text-slate-300">
            Опишите проблему, и заявка сразу уйдёт на почту поддержки. Ответ придёт на указанный email.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSupportSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="support-name" className="text-slate-200">Имя</Label>
              <Input
                id="support-name"
                placeholder="Как к вам обращаться"
                value={supportForm.name}
                onChange={(event) => updateSupportField("name", event.target.value)}
                disabled={submitting}
                className="border-white/10 bg-black/20 text-white placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="support-email" className="text-slate-200">Email для ответа</Label>
              <Input
                id="support-email"
                type="email"
                placeholder="support-contact@email.com"
                value={supportForm.email}
                onChange={(event) => updateSupportField("email", event.target.value)}
                disabled={submitting}
                autoComplete="email"
                className="border-white/10 bg-black/20 text-white placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-200">Категория</Label>
            <Select
              value={supportForm.category}
              onValueChange={(value: SupportCategory) => updateSupportField("category", value)}
              disabled={submitting}
            >
              <SelectTrigger className="border-white/10 bg-black/20 text-white">
                <SelectValue placeholder="Выберите категорию" />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-slate-900 text-white">
                {Object.entries(supportCategoryLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value} className="text-white focus:bg-white/10 focus:text-white">
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="support-subject" className="text-slate-200">Тема</Label>
            <Input
              id="support-subject"
              placeholder="Например: не приходит письмо подтверждения"
              value={supportForm.subject}
              onChange={(event) => updateSupportField("subject", event.target.value)}
              disabled={submitting}
              className="border-white/10 bg-black/20 text-white placeholder:text-slate-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="support-message" className="text-slate-200">Описание проблемы</Label>
            <Textarea
              id="support-message"
              placeholder="Опишите, что произошло, на каком шаге и какой результат ожидали."
              value={supportForm.message}
              onChange={(event) => updateSupportField("message", event.target.value)}
              disabled={submitting}
              className="min-h-32 border-white/10 bg-black/20 text-white placeholder:text-slate-500"
            />
            <p className="text-xs leading-5 text-slate-400">
              К заявке автоматически добавятся текущая страница и техническая информация браузера.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={submitting}
              className="text-slate-300 hover:bg-white/5 hover:text-white"
            >
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="text-white"
              style={{ backgroundColor: "#1e7ff7" }}
            >
              {submitting ? "Отправляем..." : "Отправить запрос"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SupportRequestDialog;
