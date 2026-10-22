/**
 * PT-BR sample-data pools for the Business and Product catalog generators (values written into
 * generated rows when the locale is pt-BR). Data, not UI text: listed as a data exception in
 * test/i18n-no-hardcoded-portuguese.test.ts. Every word list here is original.
 */
export const ptBrBusinessPools = {
  company: { first: ['Aroeira', 'Cerrado', 'Jacarandá', 'Mantiqueira', 'Pitanga', 'Ipê Roxo', 'Buriti', 'Maré Alta', 'Serra Azul', 'Tucano', 'Carnaúba', 'Vento Sul'], second: ['Alimentos', 'Comércio', 'Logística', 'Sistemas', 'Têxtil', 'Engenharia', 'Serviços', 'Tecnologia', 'Transportes', 'Agro'], suffix: ['Ltda.', 'S.A.', 'ME', 'EPP'] },
  departments: ['Contabilidade', 'Atendimento ao Cliente', 'Engenharia', 'Financeiro', 'Recursos Humanos', 'Jurídico', 'Logística', 'Marketing', 'Operações', 'Compras', 'Produto', 'Qualidade', 'Pesquisa e Desenvolvimento', 'Vendas', 'Segurança'],
  sectors: ['Agropecuária', 'Construção', 'Educação', 'Energia', 'Serviços Financeiros', 'Saúde', 'Hotelaria', 'Tecnologia da Informação', 'Indústria', 'Mídia e Entretenimento', 'Mineração', 'Imobiliário', 'Varejo', 'Telecomunicações', 'Transportes', 'Serviços Públicos'],
  leadSources: ['Formulário do site', 'Indicação', 'Feira', 'Ligação ativa', 'Campanha de e-mail', 'Redes sociais', 'Webinar', 'Parceiro', 'Busca paga', 'Busca orgânica', 'Evento', 'Chat'],
  leadStatuses: ['Novo', 'Contatado', 'Em andamento', 'Em nutrição', 'Qualificado', 'Desqualificado', 'Convertido', 'Perdido']
}

export const ptBrProductPools = {
  /** Language names keyed by ISO 639-1 code. */
  languages: { en: 'Inglês', pt: 'Português', es: 'Espanhol', fr: 'Francês', de: 'Alemão', it: 'Italiano', nl: 'Holandês', sv: 'Sueco', da: 'Dinamarquês', fi: 'Finlandês', pl: 'Polonês', cs: 'Tcheco', el: 'Grego', tr: 'Turco', ru: 'Russo', uk: 'Ucraniano', ar: 'Árabe', he: 'Hebraico', hi: 'Hindi', bn: 'Bengali', zh: 'Chinês', ja: 'Japonês', ko: 'Coreano', vi: 'Vietnamita', th: 'Tailandês', id: 'Indonésio', sw: 'Suaíli', hu: 'Húngaro', ro: 'Romeno', ca: 'Catalão', eu: 'Basco', ga: 'Irlandês', cy: 'Galês', is: 'Islandês' } as Record<string, string>,
  colors: ['Preto', 'Branco', 'Grafite', 'Marfim', 'Azul-marinho', 'Azul-celeste', 'Verde-azulado', 'Verde-floresta', 'Verde-oliva', 'Mostarda', 'Laranja-queimado', 'Carmim', 'Bordô', 'Lavanda', 'Ameixa', 'Areia', 'Bege', 'Prata'],
  categories: ['Livros', 'Eletrônicos', 'Jardim', 'Mercearia', 'Saúde e Beleza', 'Casa e Cozinha', 'Música', 'Papelaria', 'Pet Shop', 'Esporte e Lazer', 'Ferramentas', 'Brinquedos e Jogos', 'Vestuário', 'Calçados', 'Automotivo'],
  productWords: { adjective: ['Compacto', 'Ergonômico', 'Dobrável', 'Térmico', 'Leve', 'Modular', 'Recarregável', 'Resistente', 'Inteligente', 'Empilhável', 'À prova d’água', 'Sem fio'], material: ['de bambu', 'de cerâmica', 'de algodão', 'de vidro', 'de couro', 'de carvalho', 'de aço', 'de lã'], noun: ['Mochila', 'Garrafa', 'Luminária', 'Fone', 'Chaleira', 'Caneca', 'Caderno', 'Vaso', 'Caixa de som', 'Banqueta', 'Sacola', 'Relógio'] },
  description: { open: ['Pensado para o dia a dia,', 'Feito para durar,', 'Produzido com cuidado,', 'Cabe em qualquer prateleira:', 'Uma melhoria prática,'], body: ['mantém a forma depois de anos de uso', 'limpa-se com um pano úmido', 'cabe com folga na mochila', 'combina com o restante da linha', 'chega desmontado e se monta em minutos', 'funciona em silêncio e gasta pouca energia'], close: ['Disponível em várias cores.', 'Garantia de dois anos.', 'Embalagem totalmente reciclável.', 'Peças de reposição vendidas separadamente.'] },
  comments: ['Chegou um dia antes e bem embalado.', 'Faz o que promete, nada além.', 'A cor é um pouco mais escura que nas fotos.', 'É o segundo que compro; continuo satisfeito.', 'O manual poderia ser mais claro.', 'Ótimo custo-benefício.', 'Parou depois de um mês; o suporte trocou rápido.', 'Mais leve do que eu esperava.', 'Compraria de novo.', 'Menor do que imaginei, confira as medidas.'],
  shippingMethods: ['Padrão', 'Expresso', 'Dia seguinte', 'Mesmo dia', 'Econômico', 'Retirada na loja', 'Transportadora', 'Internacional prioritário']
}
