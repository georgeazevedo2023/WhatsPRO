import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MessageSquare, Mail, Lock, ArrowRight, Loader2, Shield, Zap, Users, Bot, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const Login = () => {
  const navigate = useNavigate();
  const { signIn, isSuperAdmin, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  useEffect(() => {
    if (user) navigate(isSuperAdmin ? '/dashboard' : '/dashboard/helpdesk', { replace: true });
  }, [user, isSuperAdmin, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    if (error) toast.error('Erro ao fazer login', { description: error.message });
    else toast.success('Login realizado!');
    setIsLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail) {
      toast.error('Digite seu email primeiro');
      return;
    }
    setIsResetting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(loginEmail, {
      redirectTo: `${window.location.origin}/dashboard`,
    });
    if (error) toast.error('Erro ao enviar email', { description: error.message });
    else toast.success('Email enviado!', { description: 'Verifique sua caixa de entrada para redefinir a senha.' });
    setIsResetting(false);
    setShowForgotPassword(false);
  };

  return (
    <div className="min-h-screen flex bg-aurora">
      {/* Left panel — Branding (desktop only) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-20 right-10 w-48 h-48 rounded-full bg-primary/8 blur-2xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-display font-bold">WhatsPRO</span>
          </div>
          <p className="text-muted-foreground text-sm">Plataforma de atendimento WhatsApp</p>
        </div>

        <div className="relative z-10 space-y-8">
          <h2 className="text-4xl font-display font-bold leading-tight">
            Conecte, atenda e<br />
            <span className="text-gradient">converta leads</span>
          </h2>

          <div className="space-y-4">
            {[
              { icon: Zap, label: 'Agente IA com qualificação automática' },
              { icon: Users, label: 'CRM Kanban integrado ao WhatsApp' },
              { icon: Bot, label: '8 tools de automação inteligente' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                {label}
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-muted-foreground/60">v2.8.0 — Multi-tenant WhatsApp CRM</p>
      </div>

      {/* Right panel — Login form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md animate-scale-in">
          {/* Mobile logo */}
          <div className="text-center mb-8 lg:hidden">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-3 shadow-lg shadow-primary/25">
              <MessageSquare className="w-7 h-7 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-display font-bold">WhatsPRO</h1>
          </div>

          <div className="glass-card p-8">
            <div className="text-center mb-6">
              <h2 className="text-xl font-display font-semibold">Bem-vindo de volta</h2>
              <p className="text-sm text-muted-foreground mt-1">Entre com sua conta para continuar</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="login-email" className="text-xs text-muted-foreground">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="login-email" type="email" placeholder="seu@email.com"
                    value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                    required disabled={isLoading}
                    className="pl-11 bg-muted/40 border-border/60 focus:bg-background"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="login-password" className="text-xs text-muted-foreground">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="login-password" type="password" placeholder="••••••••"
                    value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                    required disabled={isLoading}
                    className="pl-11 bg-muted/40 border-border/60 focus:bg-background"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full h-11 gap-2 mt-2" disabled={isLoading}>
                {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Entrando...</> : <>Entrar<ArrowRight className="w-4 h-4" /></>}
              </Button>
            </form>

            <div className="text-center mt-3">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-xs text-primary/70 hover:text-primary transition-colors"
              >
                Esqueceu sua senha?
              </button>
            </div>

            {showForgotPassword && (
              <div className="mt-4 pt-4 border-t border-border/30">
                <form onSubmit={handleForgotPassword} className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Digite seu email acima e clique para receber o link de redefinição.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowForgotPassword(false)}
                      className="h-9"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </Button>
                    <Button type="submit" variant="outline" size="sm" className="flex-1 h-9 gap-2" disabled={isResetting || !loginEmail}>
                      {isResetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                      Enviar link de recuperação
                    </Button>
                  </div>
                </form>
              </div>
            )}

            <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-border/30">
              <Shield className="w-3.5 h-3.5 text-primary/60" />
              <span className="text-xs text-muted-foreground/60">Conexão segura e criptografada</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
