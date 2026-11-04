import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { api, errorMessage } from '../services/api.js';
import { phoneMask } from '../utils/format.js';
import { Button, Callout, Field, Input, Modal, Textarea, Toggle } from './ui/index.js';

const schema = z
  .object({
    firstName: z.string().trim().min(1, 'Informe o nome').max(80),
    lastName: z.string().trim().min(1, 'Informe o sobrenome').max(120),
    phone: z.string().refine((v) => v.replace(/\D/g, '').length >= 10, 'Telefone com DDD (10 ou 11 dígitos)'),
    notes: z.string().max(2000).optional(),
    confidential: z.boolean(),
    alias: z.string().max(80).optional(),
  })
  .refine((v) => !v.confidential || (v.alias && v.alias.trim().length >= 3), {
    message: 'Defina um nome de exibição (mín. 3 caracteres)',
    path: ['alias'],
  });

/**
 * Cadastro/edição de cliente — apenas os dados realmente coletados pela recepção
 * (nome, sobrenome e telefone), seguindo o princípio de minimização da LGPD.
 * `client` deve conter os dados reais (obtidos via /reveal quando confidencial).
 */
export function ClientFormModal({ open, onClose, client, initialName = '', onSaved }) {
  const { can } = useAuth();
  const toast = useToast();
  const canConfidential = can('clients:confidential');
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) return;
    const [first, ...rest] = initialName.trim().split(' ');
    reset({
      firstName: client?.firstName ?? (initialName ? first : ''),
      lastName: client?.lastName ?? rest.join(' '),
      phone: client?.phone ?? '',
      notes: client?.notes ?? '',
      confidential: client?.confidential ?? false,
      alias: client?.alias ?? '',
    });
  }, [open, client, initialName, reset]);

  const confidential = watch('confidential');

  const onSubmit = async (values) => {
    try {
      const payload = { ...values, alias: values.confidential ? values.alias : '' };
      const { data } = client?._id ? await api.patch(`/clients/${client._id}`, payload) : await api.post('/clients', payload);
      toast.success(client?._id ? 'Cliente atualizado.' : 'Cliente cadastrado.', data.code);
      onSaved?.(data);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={client?._id ? 'Editar cliente' : 'Novo cliente'}
      description="Coletamos somente o necessário para o atendimento."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="dark" type="submit" form="client-form" loading={isSubmitting}>
            {client?._id ? 'Salvar alterações' : 'Cadastrar cliente'}
          </Button>
        </>
      }
    >
      <form id="client-form" onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Nome" required error={errors.firstName?.message}>
          <Input {...register('firstName')} invalid={errors.firstName} autoComplete="off" />
        </Field>
        <Field label="Sobrenome" required error={errors.lastName?.message}>
          <Input {...register('lastName')} invalid={errors.lastName} autoComplete="off" />
        </Field>
        <Field label="Telefone" required error={errors.phone?.message} className="sm:col-span-2">
          <Input
            {...register('phone')}
            inputMode="tel"
            placeholder="(11) 90000-0000"
            invalid={errors.phone}
            onChange={(e) => setValue('phone', phoneMask(e.target.value), { shouldValidate: Boolean(errors.phone) })}
          />
        </Field>
        <Field label="Observações internas" hint="Visíveis apenas para a equipe administrativa." className="sm:col-span-2">
          <Textarea {...register('notes')} rows={3} />
        </Field>

        <div className="rounded-lg border border-line bg-zinc-50/60 p-4 sm:col-span-2">
          <Toggle
            checked={confidential}
            onChange={(v) => setValue('confidential', v)}
            disabled={!canConfidential}
            label="Cliente confidencial"
            description="Nome real e telefone ficam ocultos em listas, agenda, dashboards e relatórios. Cada acesso aos dados é auditado."
          />
          {confidential && (
            <Field label="Nome de exibição" required error={errors.alias?.message} className="mt-4" hint="Ex.: Piloto Reservado 03">
              <Input {...register('alias')} prefix={<Lock className="size-3.5" />} invalid={errors.alias} />
            </Field>
          )}
          {!canConfidential && (
            <Callout tone="neutral" className="mt-3">
              Seu perfil não pode marcar clientes como confidenciais.
            </Callout>
          )}
        </div>
      </form>
    </Modal>
  );
}
