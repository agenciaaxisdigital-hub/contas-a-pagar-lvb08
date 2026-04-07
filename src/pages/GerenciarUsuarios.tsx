import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, User, Shield, Eye, EyeOff, ArrowLeft, Loader2, Pencil, Trash2, X, KeyRound } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AppLayout from '@/components/AppLayout';
import { cn } from '@/lib/utils';

interface Usuario {
  id: string;
  nome: string;
  tipo: string;
  criado_em: string;
  auth_user_id: string;
}

export default function GerenciarUsuarios() {
  const { isAdmin, usuario: usuarioAtual } = useAuth();
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Create form
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [tipo, setTipo] = useState<'usuario' | 'admin'>('usuario');
  const [showSenha, setShowSenha] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editTipo, setEditTipo] = useState<'usuario' | 'admin'>('usuario');
  const [editSenha, setEditSenha] = useState('');
  const [showEditSenha, setShowEditSenha] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [showResetSenha, setShowResetSenha] = useState(false);

  // Delete state
  const [deletingUser, setDeletingUser] = useState<Usuario | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    fetchUsuarios();
  }, [isAdmin]);

  const fetchUsuarios = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('usuarios')
      .select('*')
      .order('nome');
    if (data) setUsuarios(data as Usuario[]);
    setLoading(false);
  };

  const handleCriar = async (e: FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !senha.trim()) {
      toast.error('Preencha nome e senha');
      return;
    }
    if (senha.length < 6) {
      toast.error('Senha deve ter pelo menos 6 caracteres');
      return;
    }

    setSaving(true);
    try {
      const res = await supabase.functions.invoke('criar-usuario', {
        body: { nome: nome.trim(), senha, tipo },
      });

      if (res.error || res.data?.error) {
        throw new Error(res.data?.error || res.error?.message || 'Erro ao criar usuário');
      }

      toast.success(`✓ Usuário "${nome}" criado com sucesso!`);
      setNome('');
      setSenha('');
      setTipo('usuario');
      setShowForm(false);
      fetchUsuarios();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar usuário');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (u: Usuario) => {
    setEditingUser(u);
    setEditNome(u.nome);
    setEditTipo(u.tipo as 'usuario' | 'admin');
    setEditSenha('');
    setShowResetSenha(false);
    setShowEditSenha(false);
  };

  const closeEdit = () => {
    setEditingUser(null);
    setEditNome('');
    setEditTipo('usuario');
    setEditSenha('');
    setShowResetSenha(false);
  };

  const handleEditar = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editNome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    if (showResetSenha && editSenha && editSenha.length < 6) {
      toast.error('Senha deve ter pelo menos 6 caracteres');
      return;
    }

    setEditSaving(true);
    try {
      const res = await supabase.functions.invoke('gerenciar-usuario', {
        body: {
          action: 'edit',
          usuario_id: editingUser.id,
          nome: editNome.trim(),
          tipo: editTipo,
          ...(showResetSenha && editSenha ? { nova_senha: editSenha } : {}),
        },
      });

      if (res.error || res.data?.error) {
        throw new Error(res.data?.error || res.error?.message || 'Erro ao editar');
      }

      toast.success('✓ Usuário atualizado!');
      closeEdit();
      fetchUsuarios();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao editar usuário');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeletar = async () => {
    if (!deletingUser) return;
    setDeleting(true);
    try {
      const res = await supabase.functions.invoke('gerenciar-usuario', {
        body: { action: 'delete', usuario_id: deletingUser.id },
      });

      if (res.error || res.data?.error) {
        throw new Error(res.data?.error || res.error?.message || 'Erro ao remover');
      }

      toast.success(`Usuário "${deletingUser.nome}" removido`);
      setDeletingUser(null);
      fetchUsuarios();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao remover usuário');
    } finally {
      setDeleting(false);
    }
  };

  const fmtData = (d: string) => {
    try { return format(parseISO(d), "dd/MM/yyyy", { locale: ptBR }); }
    catch { return d; }
  };

  const tipoLabel = (t: string) => t === 'admin' ? 'Administrador' : 'Usuário';
  const tipoCor = (t: string) => t === 'admin' ? 'text-primary bg-primary/10' : 'text-muted-foreground bg-muted';

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="text-center py-20 space-y-3">
          <p className="text-4xl">🔒</p>
          <p className="text-muted-foreground font-medium">Acesso restrito a administradores</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-5 animate-fade-in pb-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin')} className="text-muted-foreground active:scale-90">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="page-title">Usuários</h2>
            <p className="page-subtitle">Gerencie o acesso da equipe</p>
          </div>
        </div>

        {/* Botão criar */}
        {!showForm && !editingUser && (
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary flex items-center justify-center gap-2"
          >
            <Plus size={18} /> Criar novo usuário
          </button>
        )}

        {/* Formulário de criação */}
        {showForm && (
          <form onSubmit={handleCriar} className="section-card space-y-4">
            <p className="section-title">Novo Usuário</p>

            <div className="space-y-1.5">
              <label className="label-micro">Nome completo *</label>
              <Input
                placeholder="Ex.: Ana Paula"
                value={nome}
                onChange={e => setNome(e.target.value)}
                className="form-input"
                autoFocus
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="label-micro">Senha inicial *</label>
              <div className="relative">
                <Input
                  type={showSenha ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  className="form-input pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowSenha(!showSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  tabIndex={-1}
                >
                  {showSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="label-micro">Tipo de acesso *</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTipo('usuario')}
                  className={cn(
                    'h-12 rounded-xl border-2 text-sm font-semibold transition-all',
                    tipo === 'usuario'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground'
                  )}
                >
                  👤 Usuário
                </button>
                <button
                  type="button"
                  onClick={() => setTipo('admin')}
                  className={cn(
                    'h-12 rounded-xl border-2 text-sm font-semibold transition-all',
                    tipo === 'admin'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground'
                  )}
                >
                  🛡️ Admin
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {tipo === 'admin'
                  ? 'Admin: aprova, paga, vê relatórios e gerencia usuários'
                  : 'Usuário: registra contas e envia comprovantes'}
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving} className="btn-primary flex items-center justify-center gap-2 flex-1">
                {saving ? <><Loader2 size={16} className="animate-spin" /> Criando...</> : '✓ Criar usuário'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setNome(''); setSenha(''); }}
                className="h-12 px-4 rounded-xl border border-border text-sm text-muted-foreground"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {/* Formulário de edição */}
        {editingUser && (
          <form onSubmit={handleEditar} className="section-card space-y-4">
            <div className="flex items-center justify-between">
              <p className="section-title">Editar Usuário</p>
              <button type="button" onClick={closeEdit} className="text-muted-foreground">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="label-micro">Nome completo *</label>
              <Input
                placeholder="Nome do usuário"
                value={editNome}
                onChange={e => setEditNome(e.target.value)}
                className="form-input"
                autoFocus
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="label-micro">Tipo de acesso *</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditTipo('usuario')}
                  className={cn(
                    'h-12 rounded-xl border-2 text-sm font-semibold transition-all',
                    editTipo === 'usuario'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground'
                  )}
                >
                  👤 Usuário
                </button>
                <button
                  type="button"
                  onClick={() => setEditTipo('admin')}
                  className={cn(
                    'h-12 rounded-xl border-2 text-sm font-semibold transition-all',
                    editTipo === 'admin'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground'
                  )}
                >
                  🛡️ Admin
                </button>
              </div>
            </div>

            {/* Reset senha toggle */}
            {!showResetSenha ? (
              <button
                type="button"
                onClick={() => setShowResetSenha(true)}
                className="flex items-center gap-2 text-sm text-primary font-medium"
              >
                <KeyRound size={14} /> Resetar senha
              </button>
            ) : (
              <div className="space-y-1.5">
                <label className="label-micro">Nova senha</label>
                <div className="relative">
                  <Input
                    type={showEditSenha ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    value={editSenha}
                    onChange={e => setEditSenha(e.target.value)}
                    className="form-input pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditSenha(!showEditSenha)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    tabIndex={-1}
                  >
                    {showEditSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowResetSenha(false); setEditSenha(''); }}
                  className="text-xs text-muted-foreground"
                >
                  Cancelar reset de senha
                </button>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={editSaving} className="btn-primary flex items-center justify-center gap-2 flex-1">
                {editSaving ? <><Loader2 size={16} className="animate-spin" /> Salvando...</> : '✓ Salvar alterações'}
              </button>
              <button
                type="button"
                onClick={closeEdit}
                className="h-12 px-4 rounded-xl border border-border text-sm text-muted-foreground"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {/* Modal confirmação de exclusão */}
        {deletingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-card rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-xl">
              <p className="text-lg font-bold text-foreground">Remover usuário?</p>
              <p className="text-sm text-muted-foreground">
                Tem certeza que deseja remover <strong>{deletingUser.nome}</strong>? 
                Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDeletar}
                  disabled={deleting}
                  className="flex-1 h-12 rounded-xl bg-destructive text-destructive-foreground font-semibold text-sm flex items-center justify-center gap-2"
                >
                  {deleting ? <><Loader2 size={16} className="animate-spin" /> Removendo...</> : '🗑️ Sim, remover'}
                </button>
                <button
                  onClick={() => setDeletingUser(null)}
                  className="h-12 px-5 rounded-xl border border-border text-sm text-muted-foreground"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lista de usuários */}
        <div className="section-card !space-y-0 !p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <p className="section-title">Equipe ({usuarios.length})</p>
          </div>

          {loading ? (
            <div className="space-y-0">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3 px-5 py-4 border-b border-border animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-muted" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 bg-muted rounded w-1/3" />
                    <div className="h-3 bg-muted rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : usuarios.length === 0 ? (
            <div className="px-5 py-10 text-center text-muted-foreground text-sm">
              Nenhum usuário cadastrado
            </div>
          ) : (
            <div>
              {usuarios.map((u, idx) => (
                <div
                  key={u.id}
                  className={cn(
                    'flex items-center gap-3 px-5 py-4',
                    idx < usuarios.length - 1 && 'border-b border-border'
                  )}
                >
                  <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-white">
                      {u.nome.substring(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{u.nome}</p>
                      {u.id === usuarioAtual?.id && (
                        <span className="text-[9px] bg-blue-100 text-blue-600 font-bold px-1.5 rounded-full">Você</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', tipoCor(u.tipo))}>
                        {tipoLabel(u.tipo)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">desde {fmtData(u.criado_em)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(u)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    {u.id !== usuarioAtual?.id && (
                      <button
                        onClick={() => setDeletingUser(u)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        title="Remover"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info sobre tipos */}
        <div className="section-card !space-y-3 bg-blue-50/50 border-blue-100">
          <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Níveis de acesso</p>
          <div className="space-y-2 text-xs text-blue-700">
            <div className="flex gap-2">
              <span>👤</span>
              <div>
                <p className="font-semibold">Usuário</p>
                <p className="text-blue-600">Registra contas, anexa comprovantes</p>
              </div>
            </div>
            <div className="flex gap-2">
              <span>🛡️</span>
              <div>
                <p className="font-semibold">Administrador</p>
                <p className="text-blue-600">Aprova, paga, vê dashboard completo, gerencia usuários e auditoria</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
