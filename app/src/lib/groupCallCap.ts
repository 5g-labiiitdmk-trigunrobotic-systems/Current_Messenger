/**
 * Group calls ring at most `cap - 1` other members (see GROUP_CALL_CAP in
 * state/groupCallStore.ts). This builds the heads-up shown before such a call
 * so nobody is left out silently: it names who will be called and who won't.
 */
export function describeGroupCallCap(others: { id: string; name: string }[], cap: number): { capped: boolean; title: string; message: string } {
  const slots = cap - 1;
  if (others.length <= slots) return { capped: false, title: '', message: '' };
  const called = others.slice(0, slots).map((o) => o.name);
  const left = others.slice(slots).map((o) => o.name);
  return {
    capped: true,
    title: `Group calls are limited to ${cap} people`,
    message: `This group has ${others.length + 1} members. This call will ring: ${called.join(', ')}. Not called: ${left.join(', ')}.`,
  };
}
