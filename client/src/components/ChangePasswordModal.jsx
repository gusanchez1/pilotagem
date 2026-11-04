import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { api, errorMessage } from '../services/api.js';
import { Button, Field, Input, Modal } from './ui/index.js';

export function ChangePasswordModal({ open, onClose }) {
  const { setToken } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.newPassword.length < 8) return setError('A nova senha deve ter ao menos 8 caracteres.');
    if (form.newPassword !== form.confirm) return setError('A confirmação não confere com a nova senha.');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/change-password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      setToken(data.token);
      toast.success('Senha alterada com sucesso.');
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Alterar senha"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="dark" type="submit" form="pwd-form" loading={busy}>Salvar nova senha</Button>
        </>
      }
    >
      <form id="pwd-form" onSubmit={submit} className="space-y-4">
        <Field label="Senha atual" required>
          <Input type="password" autoComplete="current-password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
        </Field>
        <Field label="Nova senha" hint="Mínimo de 8 caracteres." required>
          <Input type="password" autoComplete="new-password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
        </Field>
        <Field label="Confirmar nova senha" required error={error}>
          <Input type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
        </Field>
      </form>
    </Modal>
  );
}
