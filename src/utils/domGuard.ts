// Keeps React working when something outside React moves its DOM nodes.
//
// Browser page translators (Chrome, Edge, Opera "Translate this page") and some extensions wrap
// text nodes in their own elements. React still holds the original nodes, so its next
// removeChild / insertBefore on them throws "NotFoundError: The node to be removed is not a child
// of this node" and the whole page unmounts (facebook/react#11538). A French page opened by a
// visitor whose browser is in English is exactly this case.
//
// The guard turns those two calls into safe no-ops when the node is no longer where React expects
// it, so the worst outcome is a stale word, never a blank page. Real parent/child mismatches are
// still reported to the console.

let installed = false;

export function installDomGuard(): void {
  if (installed || typeof Node === 'undefined' || !Node.prototype) return;
  installed = true;

  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function guardedRemoveChild<T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) {
      console.warn('[dom-guard] removeChild skipped: node has another parent (page translator or extension?)', child);
      // Still take it out of the document, where React meant it to be gone.
      if (child.parentNode) child.parentNode.removeChild(child);
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function guardedInsertBefore<T extends Node>(this: Node, node: T, ref: Node | null): T {
    if (ref && ref.parentNode !== this) {
      console.warn('[dom-guard] insertBefore: reference node has another parent; appending instead', ref);
      return originalInsertBefore.call(this, node, null) as T;
    }
    return originalInsertBefore.call(this, node, ref) as T;
  };
}
