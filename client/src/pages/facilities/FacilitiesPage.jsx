import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Building2, Cpu, Pencil, Plus, Users, Wrench } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  DataTable,
  Field,
  Input,
  Modal,
  MoneyInput,
  PageHeader,
  Select,
  Spinner,
  StatusBadge,
  Tabs,
  Textarea,
  Toggle,
} from '../../components/ui/index.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useCatalog } from '../../hooks/useCatalog.js';
import { api, errorMessage } from '../../services/api.js';
import { money, time } from '../../utils/format.js';
import { RESOURCE_CATEGORY, RESOURCE_STATUS, ROOM_STATUS, ROOM_TYPE, options } from '../../utils/labels.js';

function RoomForm({ open, onClose, room, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (p) => setF((prev) => ({ ...prev, ...p }));
  useEffect(() => {
    if (open)
      setF(
        room
          ? { ...room, amenities: room.amenities.join(', '), hourlyRate: room.hourlyRate ?? 0, capacity: room.capacity ?? '' }
          : { name: '', code: '', type: 'multiuso', description: '', capacity: '', amenities: '', status: 'ativa', shared: false, hourlyRate: 0 },
      );
  }, [open, room]);
  const submit = async () => {
    setBusy(true);
    const payload = {
      name: f.name,
      code: f.code,
      type: f.type,
      description: f.description,
      capacity: f.capacity === '' ? null : Number(f.capacity),
      amenities: f.amenities.split(',').map((s) => s.trim()).filter(Boolean),
      status: f.status,
      shared: f.shared,
      hourlyRate: f.hourlyRate || null,
    };
    try {
      if (room) await api.put(`/rooms/${room._id}`, payload);
      else await api.post('/rooms', payload);
      toast.success('Sala salva.');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} size="lg" title={room ? 'Editar sala' : 'Nova sala'} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={busy} onClick={submit}>Salvar</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" required><Input value={f.name || ''} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Identificação" required hint="Ex.: SIM-01"><Input value={f.code || ''} onChange={(e) => set({ code: e.target.value.toUpperCase() })} /></Field>
        <Field label="Tipo"><Select value={f.type} onChange={(e) => set({ type: e.target.value })} options={options(ROOM_TYPE)} /></Field>
        <Field label="Status"><Select value={f.status} onChange={(e) => set({ status: e.target.value })} options={options(ROOM_STATUS)} /></Field>
        <Field label="Capacidade (pessoas)"><Input type="number" min={0} value={f.capacity} onChange={(e) => set({ capacity: e.target.value })} /></Field>
        <Field label="Valor de locação por hora"><MoneyInput value={f.hourlyRate || 0} onChange={(v) => set({ hourlyRate: v })} /></Field>
        <Field label="Recursos disponíveis" hint="Separados por vírgula" className="sm:col-span-2"><Input value={f.amenities || ''} onChange={(e) => set({ amenities: e.target.value })} /></Field>
        <Field label="Descrição" className="sm:col-span-2"><Textarea rows={2} value={f.description || ''} onChange={(e) => set({ description: e.target.value })} /></Field>
        <div className="sm:col-span-2">
          <Toggle checked={Boolean(f.shared)} onChange={(v) => set({ shared: v })} label="Uso compartilhado" description="Permite treinamentos simultâneos em equipamentos diferentes (ex.: sala com vários simuladores). Locação, eventos e manutenção continuam ocupando a sala inteira." />
        </div>
      </div>
    </Modal>
  );
}

function ResourceForm({ open, onClose, resource, rooms, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (p) => setF((prev) => ({ ...prev, ...p }));
  useEffect(() => {
    if (open) setF(resource ? { ...resource, room: resource.room?._id || '' } : { name: '', code: '', category: 'simulador', description: '', location: '', room: '', status: 'disponivel', notes: '' });
  }, [open, resource]);
  const submit = async () => {
    setBusy(true);
    const roomObj = rooms.find((r) => r._id === f.room);
    const payload = { name: f.name, code: f.code, category: f.category, description: f.description, location: roomObj?.name || f.location, room: f.room || null, status: f.status, notes: f.notes };
    try {
      if (resource) await api.put(`/resources/${resource._id}`, payload);
      else await api.post('/resources', payload);
      toast.success('Equipamento salvo.');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} size="lg" title={resource ? 'Editar equipamento' : 'Novo equipamento'} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={busy} onClick={submit}>Salvar</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" required><Input value={f.name || ''} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Identificação" required><Input value={f.code || ''} onChange={(e) => set({ code: e.target.value.toUpperCase() })} /></Field>
        <Field label="Categoria"><Select value={f.category} onChange={(e) => set({ category: e.target.value })} options={options(RESOURCE_CATEGORY)} /></Field>
        <Field label="Status"><Select value={f.status} onChange={(e) => set({ status: e.target.value })} options={options(RESOURCE_STATUS)} /></Field>
        <Field label="Localização (sala)"><Select value={f.room || ''} onChange={(e) => set({ room: e.target.value })} placeholder="Sem sala fixa" options={rooms.map((r) => ({ value: r._id, label: r.name }))} /></Field>
        {!f.room && <Field label="Localização (texto)"><Input value={f.location || ''} onChange={(e) => set({ location: e.target.value })} /></Field>}
        <Field label="Descrição" className="sm:col-span-2"><Textarea rows={2} value={f.description || ''} onChange={(e) => set({ description: e.target.value })} /></Field>
        <Field label="Observações" className="sm:col-span-2"><Textarea rows={2} value={f.notes || ''} onChange={(e) => set({ notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

export default function FacilitiesPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get('aba') === 'equipamentos' ? 'equipamentos' : 'salas');
  const catalog = useCatalog({ include: ['rooms', 'resources'] });
  const now = useApi('/availability/now', { initial: [] });
  const [roomForm, setRoomForm] = useState({ open: false });
  const [resForm, setResForm] = useState({ open: false });
  const admin = can('rooms:manage');

  const setStatus = async (kind, item, status) => {
    try {
      await api.patch(`/${kind}/${item._id}/status`, { status });
      toast.success('Status atualizado.');
      catalog.reload();
      now.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const resColumns = [
    { key: 'code', header: 'Código', render: (r) => <span className="font-mono text-xs text-zinc-500">{r.code}</span> },
    { key: 'name', header: 'Equipamento', render: (r) => <div><p className="font-medium text-zinc-900">{r.name}</p>{r.notes && <p className="line-clamp-1 text-xs text-zinc-500">{r.notes}</p>}</div> },
    { key: 'cat', header: 'Categoria', hideOn: 'sm', render: (r) => RESOURCE_CATEGORY[r.category] },
    { key: 'loc', header: 'Localização', hideOn: 'md', render: (r) => r.room?.name || r.location || '—' },
    {
      key: 'status',
      header: 'Status',
      render: (r) =>
        admin ? (
          <div className="w-40">
            <Select value={r.status} onChange={(e) => setStatus('resources', r, e.target.value)} options={options(RESOURCE_STATUS)} aria-label="Status" />
          </div>
        ) : (
          <StatusBadge map={RESOURCE_STATUS} value={r.status} />
        ),
    },
    admin && { key: 'act', header: '', align: 'right', render: (r) => <Button size="icon" variant="ghost" onClick={() => setResForm({ open: true, resource: r })} aria-label="Editar"><Pencil className="size-4" /></Button> },
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        title="Salas e equipamentos"
        description="Cadastros independentes de espaços e de equipamentos reserváveis. Dados demonstrativos — configure conforme a estrutura real."
        actions={admin && (tab === 'salas' ? <Button variant="primary" icon={Plus} onClick={() => setRoomForm({ open: true })}>Nova sala</Button> : <Button variant="primary" icon={Plus} onClick={() => setResForm({ open: true })}>Novo equipamento</Button>)}
      />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'salas', label: 'Salas', icon: Building2, count: catalog.rooms.length }, { value: 'equipamentos', label: 'Equipamentos e simuladores', icon: Cpu, count: catalog.resources.length }]} />

      {catalog.loading && !catalog.rooms.length ? (
        <Spinner />
      ) : tab === 'salas' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {catalog.rooms.map((r) => {
            const occ = now.data.find((x) => x._id === r._id);
            const resources = catalog.resources.filter((x) => (x.room?._id || x.room) === r._id);
            return (
              <Card key={r._id} className="flex flex-col">
                <div className="flex-1 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-[11px] text-zinc-500">{r.code}</p>
                      <h3 className="font-semibold text-zinc-950">{r.name}</h3>
                    </div>
                    {r.status !== 'ativa' ? (
                      <StatusBadge map={ROOM_STATUS} value={r.status} />
                    ) : occ?.occupied ? (
                      <Badge tone="amber">Ocupada até {time(occ.until)}</Badge>
                    ) : (
                      <Badge tone="green">Livre agora</Badge>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-zinc-500">{r.description}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <Badge tone="zinc" dot={false}>{ROOM_TYPE[r.type]}</Badge>
                    {r.capacity && <Badge tone="zinc" dot={false}><Users className="size-3" /> {r.capacity}</Badge>}
                    {r.shared && <Badge tone="blue" dot={false}>Uso compartilhado</Badge>}
                    {r.amenities.map((a) => <Badge key={a} tone="zinc" dot={false}>{a}</Badge>)}
                  </div>
                  {resources.length > 0 && (
                    <p className="mt-3 flex items-start gap-1.5 text-xs text-zinc-600">
                      <Cpu className="mt-0.5 size-3.5 shrink-0" />
                      {resources.map((x) => (
                        <span key={x._id} className={x.status !== 'disponivel' ? 'text-red-600 line-through' : ''}>{x.code}</span>
                      )).reduce((acc, el, i) => (i ? [...acc, ', ', el] : [el]), [])}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3">
                  <span className="text-sm text-zinc-600">{r.hourlyRate ? <>Locação <strong className="tabular text-zinc-900">{money(r.hourlyRate)}</strong>/h</> : 'Sem locação'}</span>
                  {admin && (
                    <div className="flex gap-1">
                      <Button size="xs" variant="ghost" icon={Wrench} onClick={() => setStatus('rooms', r, r.status === 'manutencao' ? 'ativa' : 'manutencao')}>
                        {r.status === 'manutencao' ? 'Reativar' : 'Manutenção'}
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setRoomForm({ open: true, room: r })} aria-label="Editar"><Pencil className="size-4" /></Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card><DataTable columns={resColumns} rows={catalog.resources} loading={catalog.loading} /></Card>
      )}

      <RoomForm open={roomForm.open} room={roomForm.room} onClose={() => setRoomForm({ open: false })} onSaved={() => { catalog.reload(); now.reload(); }} />
      <ResourceForm open={resForm.open} resource={resForm.resource} rooms={catalog.rooms} onClose={() => setResForm({ open: false })} onSaved={catalog.reload} />
    </>
  );
}
