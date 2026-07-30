import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLogin } from "@workspace/api-client-react";
import { Network, UserRound } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const DEMO_ACCOUNTS = [
  { label: "Вася", role: "Руководитель", username: "vasya", password: "vasya123" },
  { label: "Алина", role: "Менеджер", username: "alina", password: "alina123" },
  { label: "Паша", role: "Менеджер", username: "pasha", password: "pasha123" },
];

export default function Login() {
  const [username, setUsername] = useState("vasya");
  const [password, setPassword] = useState("vasya123");
  const [, setLocation] = useLocation();
  const login = useLogin();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    login.mutate(
      { data: { username, password } },
      {
        onSuccess: (data) => {
          queryClient.invalidateQueries();
          setLocation(data.role === "admin" ? "/dashboard" : "/workspace");
        },
        onError: () => {
          toast({
            title: "Ошибка",
            description: "Неверный логин или пароль",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
      <div className="mb-8 flex items-center gap-2 text-primary">
        <Network className="h-8 w-8" />
        <span className="text-2xl font-bold tracking-tight">CRM</span>
      </div>
      <Card className="w-full max-w-sm border-border/50 shadow-xl">
        <CardHeader className="space-y-1 pb-6">
          <CardTitle className="text-center text-2xl font-bold">Вход в CRM</CardTitle>
          <CardDescription className="text-center">Выберите пользователя или введите логин и пароль</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <Button
                  key={account.username}
                  type="button"
                  variant={username === account.username ? "default" : "outline"}
                  className="h-auto flex-col gap-1 px-2 py-2"
                  onClick={() => {
                    setUsername(account.username);
                    setPassword(account.password);
                  }}
                >
                  <UserRound className="h-4 w-4" />
                  <span className="text-xs leading-none">{account.label}</span>
                  <span className="text-[10px] font-normal leading-none opacity-70">{account.role}</span>
                </Button>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Логин</Label>
              <Input id="username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full font-medium" disabled={login.isPending}>
              {login.isPending ? "Входим..." : "Войти"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
