// ------------------- BACKEND (index.js) -------------------
// Este arquivo roda no servidor (Render), não no navegador.

import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';

// 1. Inicialização do Servidor Express
const app = express();
const port = process.env.PORT || 10000;

// 2. Middlewares
// Configuração de CORS para permitir requisições apenas do seu site no Netlify e do ambiente local
const whitelist = ['https://inspiring-pika-02f0fd.netlify.app', 'http://localhost:3000', 'http://127.0.0.1:3000'];
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
};
app.use(cors(corsOptions));
app.use(express.json());

// 3. Inicialização da API Gemini
// A chave é lida das variáveis de ambiente do Render para segurança
if (!process.env.API_KEY) {
    console.error("ERRO CRÍTICO: A variável de ambiente API_KEY não foi definida no Render.");
}
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Endpoint de "saúde" para verificar se o servidor está no ar
app.get('/', (req, res) => {
    res.status(200).send('Servidor de Petições está no ar!');
});

// 4. Definição da Rota da API
app.post('/api/generate-petition', async (req, res) => {
    try {
        const data = req.body;

        // Validação mínima dos dados recebidos
        if (!data || Object.keys(data).length === 0) {
            return res.status(400).json({ error: 'Nenhum dado recebido do formulário.' });
        }

        // 5. Construção do Prompt para a IA
        const prompt = `
            Você é um assistente jurídico especialista em criar petições iniciais para o Juizado Especial Cível (JEC) do Brasil, com foco em direito do consumidor contra concessionárias de energia elétrica. Sua linguagem deve ser formal, clara, objetiva e persuasiva.
            Baseado nos dados do formulário abaixo, gere o texto completo de uma petição inicial.

            ESTRUTURA DA PETIÇÃO:
            1.  **Endereçamento:** "EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DO JUIZADO ESPECIAL CÍVEL DA COMARCA DE ${data['action-city-state'] || '[Cidade e Estado não informados]}."
            2.  **Qualificação Completa do Autor:** Inclua: Nome Completo, nacionalidade (brasileiro(a)), estado civil (informar "estado civil desconhecido"), profissão (informar "profissão desconhecida"), portador(a) do CPF nº, e endereço completo com CEP. Use os dados fornecidos.
            3.  **Qualificação da Ré:** Inclua: Nome da empresa, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${data['company-details'] ? `(CNPJ: ${data['company-details']})` : '(a ser consultado)'}, com sede em ${data['company-details'] ? `(${data['company-details']})` : '(endereço a ser consultado)'}.
            4.  **Seção "DOS FATOS":** Narre os acontecimentos de forma cronológica e detalhada, usando as respostas do usuário. Seja claro, coeso e direto. Transforme os dados brutos em uma narrativa fluida.
            5.  **Seção "DO DIREITO":** Fundamente juridicamente o pedido. Cite o Código de Defesa do Consumidor (CDC), especialmente a falha na prestação de serviço (Art. 14), a responsabilidade objetiva da empresa, e, se aplicável, a cobrança indevida e o direito à repetição de indébito (Art. 42), e o dano moral puro (in re ipsa) pela perda de tempo útil e pelo transtorno causado.
            6.  **Seção "DA TUTELA DE URGÊNCIA" (APENAS SE SOLICITADO):** Se o usuário pediu uma decisão urgente ('urgent-decision' === 'sim'), crie esta seção. Justifique a necessidade da medida liminar com base no "periculum in mora" (o perigo da demora, ex: o autor está sem energia) e no "fumus boni iuris" (a fumaça do bom direito, ex: as contas estão pagas), explicando por que o autor não pode esperar pela decisão final.
            7.  **Seção "DOS PEDIDOS":** Liste todos os pedidos de forma clara e numerada:
                a) A citação da ré para responder à presente ação, sob pena de revelia;
                b) ${data['urgent-decision'] === 'sim' ? 'A concessão da tutela de urgência, para determinar que a ré [descreva o pedido liminar com base nos fatos, ex: restabeleça o fornecimento de energia no endereço do autor em 24h, sob pena de multa diária];' : ''}
                c) A inversão do ônus da prova, conforme o Art. 6º, VIII, do CDC;
                d) A procedência total da ação para confirmar a tutela de urgência (se houver) e condenar a ré a:
                    ${data['material-value'] && data['material-value'] !== 'R$ 0,00' ? `   - Pagar indenização por danos materiais no valor de ${data['material-value']};` : ''}
                    ${data['dano-moral-pergunta'] === 'sim' ? `   - Pagar indenização por danos morais em valor de ${data['moral-value'] || 'R$ 5.000,00 (cinco mil reais)'}, ou em valor superior a ser arbitrado por Vossa Excelência;` : ''}
                e) A condenação da ré ao pagamento das custas processuais e honorários advocatícios, se houver.
            8.  **Seção "DO VALOR DA CAUSA":** Atribua à causa o valor de R$ [some os valores de dano material e moral aqui, se o dano moral não tiver valor, some 5000].
            9.  **Fechamento:** "Nestes termos, pede deferimento. \n\n${data['action-city-state'] || '[Local]'}, [Data]. \n\n________________________________________\n${data['author-name'] || '[Nome Completo do Autor]'}"

            DADOS DETALHADOS DO CASO PARA USAR NA NARRAÇÃO DOS FATOS:
            - **Tipo de Problema:** ${data['problem-type']}
            - **Resumo dos Dados Fornecidos:** ${JSON.stringify(data, null, 2)}
            
            Agora, redija a petição completa.
        `;

        // 6. Chamada para a API do Gemini
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: [{ parts: [{ text: prompt }] }],
        });

        const petitionText = response.text;
        res.json({ text: petitionText });

    } catch (error) {
        console.error("Erro detalhado ao chamar a API Gemini:", error);
        res.status(500).json({ 
            error: 'Falha ao comunicar com a IA no servidor.',
            details: error.message 
        });
    }
});

// 7. Inicia o Servidor
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
