// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MoneyInput } from '../../components/MoneyInput';

afterEach(cleanup);

describe('MoneyInput', () => {
  it('guarda al salir: se puede escribir aunque el valor de afuera no cambie (error de la Fase 4)', () => {
    const onCommit = vi.fn();
    render(<MoneyInput value={0} ariaLabel="Presupuesto" onCommit={onCommit} />);
    const input = screen.getByLabelText('Presupuesto') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.change(input, { target: { value: '500000' } });
    expect(input.value).toBe('500.000');
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith(500_000);
  });

  it('controlado: refleja lo escrito y avisa cada cambio', () => {
    function Controlled() {
      const [v, setV] = useState(0);
      return (
        <>
          <MoneyInput value={v} onChange={setV} ariaLabel="Monto" />
          <output>{v}</output>
        </>
      );
    }
    render(<Controlled />);
    const input = screen.getByLabelText('Monto') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1234567' } });
    expect(input.value).toBe('1.234.567');
    expect(screen.getByRole('status').textContent).toBe('1234567');
  });

  it('si el valor cambia desde afuera, lo muestra', () => {
    const { rerender } = render(<MoneyInput value={1000} ariaLabel="Saldo" />);
    const input = screen.getByLabelText('Saldo') as HTMLInputElement;
    expect(input.value).toBe('1.000');
    rerender(<MoneyInput value={250000} ariaLabel="Saldo" />);
    expect(input.value).toBe('250.000');
  });
});
