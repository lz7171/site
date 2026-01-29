
import React from 'react';
import { Product } from './types';

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'b1',
    name: 'THE BOSS SMASH',
    price: 34.90,
    description: 'Double smash de 90g (blend Angus), queijo cheddar inglês derretido, cebola roxa marinada, picles artesanal e o nosso molho secreto da casa no pão brioche amanteigado.',
    category: 'Hambúrgueres',
    image: 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&q=80&w=800',
    stock: 100
  },
  {
    id: 'b2',
    name: 'TRUFFLE LUXURY',
    price: 49.00,
    description: 'Um clássico sofisticado: 200g de Angus moído na hora, maionese de trufas brancas, cogumelos Paris salteados na manteiga de ervas e queijo Brie premium.',
    category: 'Hambúrgueres',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=800',
    stock: 50
  },
  {
    id: 'b3',
    name: 'SMOKY BACON',
    price: 42.90,
    description: 'Para os amantes de defumados: 180g de blend exclusivo, bacon caramelizado no açúcar mascavo, queijo prato, cebola crispy e BBQ artesanal.',
    category: 'Hambúrgueres',
    image: 'https://images.unsplash.com/photo-1550317144-b38c5f6240bb?auto=format&fit=crop&q=80&w=800',
    stock: 80
  },
  {
    id: 'a1',
    name: 'RUSTIC GOLD FRIES',
    price: 24.00,
    description: 'Batatas selecionadas, cortadas à mão e fritas em duas etapas para garantir crocância máxima. Finalizadas com flor de sal e alecrim.',
    category: 'Acompanhamentos',
    image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&q=80&w=800',
    stock: 200
  },
  {
    id: 'd1',
    name: 'SHAKE BELGIUM',
    price: 28.00,
    description: 'Gelato de baunilha de Madagascar batido com chocolate belga 70% cacau e pedaços crocantes de cookie artesanal.',
    category: 'Bebidas',
    image: 'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?auto=format&fit=crop&q=80&w=800',
    stock: 60
  }
];

// Fix: Added missing Icons export required by ProjectCard.tsx
export const Icons = {
  ExternalLink: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
  ),
  Github: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
  )
};
