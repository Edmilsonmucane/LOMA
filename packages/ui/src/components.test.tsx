import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button, Field, Table, Tabs, Drawer, CommandPalette } from './index';
describe('accessible components', () => {
  it('prevents duplicate submission while loading', async () => {
    const action = vi.fn();
    render(
      <Button loading onClick={action}>
        A guardar
      </Button>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(action).not.toHaveBeenCalled();
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });
  it('links an error to its labelled field', () => {
    render(<Field label="Telemóvel" error="Verifique o número" />);
    const input = screen.getByLabelText('Telemóvel');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Verifique o número');
  });
  it('renders columns with accessible headers', () => {
    render(
      <Table
        label="Clientes"
        rows={[{ id: '1', name: 'Amélia' }]}
        columns={[{ key: 'name', heading: 'Nome', render: (row) => row.name }]}
      />,
    );
    expect(screen.getByRole('table', { name: 'Clientes' })).toBeVisible();
    expect(screen.getByRole('columnheader')).toHaveTextContent('Nome');
    expect(screen.getByRole('cell')).toHaveTextContent('Amélia');
  });
  it('switches tabs with arrow keys', async () => {
    render(
      <Tabs
        label="Ficha"
        items={[
          { value: 'a', label: 'Dados', content: 'Nome' },
          { value: 'b', label: 'history', content: 'Pagamentos' },
        ]}
      />,
    );
    screen.getByRole('tab', { name: 'Dados' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'history' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Pagamentos');
  });
  it('opens a drawer, traps focus and restores it on Escape', async () => {
    render(
      <Drawer
        title="Cliente"
        description="Novo registo"
        closeLabel="Fechar"
        trigger={<Button>Criar</Button>}
      >
        <Field label="Nome" />
      </Drawer>,
    );
    const trigger = screen.getByRole('button', { name: 'Criar' });
    await userEvent.click(trigger);
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Cliente');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
  it('filters commands and selects using keyboard', async () => {
    const action = vi.fn();
    render(
      <CommandPalette
        title="Pesquisa"
        description="Atalhos"
        searchLabel="Pesquisar"
        emptyLabel="Sem resultados"
        closeLabel="Fechar"
        trigger={<Button>Abrir</Button>}
        items={[
          { id: 'a', label: 'Cobranças', onSelect: action },
          { id: 'b', label: 'Clientes', onSelect: vi.fn() },
        ]}
      />,
    );
    await userEvent.keyboard('{Control>}k{/Control}');
    await userEvent.type(screen.getByRole('combobox'), 'cobrancas');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    await userEvent.keyboard('{Enter}');
    expect(action).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
