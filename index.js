// ------------------- BACKEND (index.js) -------------------
// Este arquivo roda no servidor (Render), não no navegador.

import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';

// 1. Inicialização do Servidor Express
const app = express();
const port = process.env.PORT || 10000;

// 2. Middlewares
// Habilita o CORS para permitir requisições do seu frontend no Netlify
app.use(cors()); 
// Habilita o parsing de JSON no corpo das requisições
app.use(express.json());

// Endpoint de "saúde" para verificar se o servidor está no ar
app.get('/', (req, res) => {
    res.status(200).send('Servidor de Petições está no ar!');
});

// 4. Definição da Rota da API para gerar petições
app.post('/api/generate-petition', async (req, res) => {
    try {
        // Verifica se a chave de API está configurada no ambiente do Render
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            console.error("ERRO CRÍTICO: A variável de ambiente API_KEY não foi definida no Render.");
            return res.status(500).json({ error: 'Configuração do servidor incompleta: API_KEY ausente.' });
        }
        
        // Inicializa o cliente da IA com a chave
        const ai = new GoogleGenAI({ apiKey });

        // Pega os dados enviados pelo formulário no frontend
        const data = req.body;
        
        // Validação mínima para garantir que os dados essenciais foram recebidos
        if (!data || !data['problem-type'] || !data['author-name']) {
            return res.status(400).json({ error: 'Dados insuficientes para gerar a petição.' });
        }
        
        // 5. Construção do Prompt para a IA
        // Este é o coração da sua aplicação. É um "template" que será preenchido
        // com os dados do usuário para instruir a IA.
        const prompt = `
            Você é um assistente jurídico especialista em criar petições iniciais para o Juizado Especial Cível (JEC) do Brasil, com foco em direito do consumidor contra concessionárias de energia elétrica. Sua linguagem deve ser formal, clara, objetiva e persuasiva.
            Baseado nos dados do formulário abaixo, gere o texto completo de uma petição inicial.

            **ESTRUTURA DA PETIÇÃO:**

            1.  **Endereçamento:** "EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DO JUIZADO ESPECIAL CÍVEL DA COMARCA DE ${data['action-city-state'] || '[Cidade e Estado não informados]}."

            2.  **Qualificação Completa do Autor:** Inclua: Nome Completo, nacionalidade (brasileiro(a)), estado civil (informar "estado civil não informado"), profissão (informar "profissão não informada"), portador(a) do CPF nº, e endereço completo. Use os dados fornecidos.

            3.  **Qualificação da Ré:** Inclua: Nome da empresa, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº (se informado, caso contrário, informar "a ser consultado"), com sede no endereço (se informado, caso contrário, informar "a ser consultado").

            4.  **Seção "DOS FATOS":** Narre os acontecimentos de forma cronológica e detalhada, usando as respostas do usuário. Seja claro e direto, transformando os dados brutos em uma narrativa coesa.

            5.  **Seção "DO DIREITO":** Fundamente juridicamente o pedido. Cite o Código de Defesa do Consumidor (CDC), especialmente a falha na prestação de serviço (Art. 14), a responsabilidade objetiva da empresa, e, se aplicável, a cobrança indevida (Art. 42), e o dano moral puro (in re ipsa) pela perda de tempo útil e pelo transtorno causado.

            6.  **Seção "DOS PEDIDOS":** Liste todos os pedidos de forma clara e numerada:
                a) A citação da ré para responder à presente ação, sob pena de revelia.
                b) A inversão do ônus da prova, conforme o Art. 6º, VIII, do CDC.
                c) A condenação da ré ao pagamento de indenização por danos materiais no valor de R$ ${data['material-value'] || '0,00'}. (Apenas se for maior que zero).
                d) A condenação da ré ao pagamento de indenização por danos morais no valor de R$ ${data['moral-value'] || '[valor a ser arbitrado por Vossa Excelência]'}, ou em valor que Vossa Excelência entender justo. (Apenas se o dano moral foi solicitado).
                e) A total procedência da ação para confirmar os pedidos acima.

            7.  **Seção "DO VALOR DA CAUSA":** Atribua à causa o valor de R$ [some os valores de dano material e moral aqui, se o dano moral não tiver valor, use um valor simbólico como R$ 1.000,00 para a soma].

            8.  **Fechamento:** "Nestes termos, pede deferimento. \n\n${data['action-city-state'] || '[Local]'}, [Data]. \n\n________________________________________\n${data['author-name'] || '[Nome Completo do Autor]'}"

            **DADOS DO FORMULÁRIO PARA PREENCHIMENTO:**
            -------------------------------------------------
            - Problema Principal: ${data['problem-type'] || 'Não especificado'}
            - Nome Completo do Autor: ${data['author-name'] || 'Não informado'}
            - CPF do Autor: ${data['author-cpf'] || 'Não informado'}
            - Endereço do Autor: ${data['author-address'] || 'Não informado'}
            - Email e Telefone: ${data['author-email']} / ${data['author-phone']}
            - Nome da Empresa Ré: ${data['company-name'] || 'Não informado'}
            - Pedido de Dano Moral: ${data['dano-moral-pergunta']}
            - Valor Sugerido Dano Moral: ${data['moral-value']}
            - Valor Dano Material: ${data['material-value']}
            - Detalhes específicos do caso (usar para a seção 'DOS FATOS'): ${JSON.stringify(data, null, 2)}
            -------------------------------------------------

            Agora, por favor, gere o texto completo e coeso da petição inicial.
        `;

        // 6. Chamada para a API do Gemini
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: [{ parts: [{ text: prompt }] }],
        });

        const petitionText = response.text;

        // 7. Envia a petição gerada de volta para o frontend
        res.json({ text: petitionText });

    } catch (error) {
        // Em caso de erro, loga no console do Render e envia uma resposta de erro para o frontend
        console.error("Erro detalhado ao chamar a API Gemini:", error);
        res.status(500).json({ 
            error: 'Falha ao gerar a petição no servidor.',
            details: error.message 
        });
    }
});

// 8. Inicia o Servidor
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
