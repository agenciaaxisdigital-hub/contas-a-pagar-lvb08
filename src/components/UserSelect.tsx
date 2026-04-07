import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Usuario {
  id: string;
  nome: string;
  tipo: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
}

export default function UserSelect({ value, onChange, label, placeholder = 'Selecionar pessoa...' }: Props) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  useEffect(() => {
    supabase
      .from('usuarios')
      .select('id, nome, tipo')
      .order('nome')
      .then(({ data }) => {
        if (data) setUsuarios(data as Usuario[]);
      });
  }, []);

  return (
    <div className="space-y-1.5">
      {label && <label className="label-micro">{label}</label>}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-12 bg-background rounded-xl">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {usuarios.map(u => (
            <SelectItem key={u.id} value={u.id}>
              {u.nome} {u.tipo === 'admin' ? '(Admin)' : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
