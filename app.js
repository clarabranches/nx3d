// Importando o SDK do Firebase via CDN (Módulos)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// COLOQUE AS SUAS CREDENCIAIS DO FIREBASE AQUI
const firebaseConfig = {
    apiKey: "AIzaSyBszG-rJmhiR4q3JleTHUPNNewNlOdPVpM",
    authDomain: "nexo3dstm.firebaseapp.com",
    projectId: "nexo3dstm",
    storageBucket: "nexo3dstm.firebasestorage.app",
    messagingSenderId: "641884862212",
    appId: "1:641884862212:web:772228dcc3843a32154251",
    measurementId: "G-NYRKQB9CG1"
};

// Inicialização Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Variáveis Globais
let configs = {
    energia: 1.5,
    consumo: 0.21,
    maquina: 0.315,
    maoobra: 5.0,
    margem: 0.4,
    embalagem: 1.5
};

let materiais = []; 
let listaDeProdutos = []; // Para guardar a lista e permitir a edição
let produtoEmEdicaoId = null; // Controla se estamos a criar ou a editar

// ==========================================
// FUNÇÕES DE CONFIGURAÇÃO E MATERIAIS
// ==========================================

window.adicionarLinhaMaterial = function(cor = "", valor = "") {
    const list = document.getElementById('materiais-list');
    const div = document.createElement('div');
    div.className = 'filamento-row form-row';
    div.innerHTML = `
        <div class="input-group"><input type="text" placeholder="Cor (Ex: Preto)" value="${cor}" class="mat-cor"></div>
        <div class="input-group"><input type="number" step="0.0001" placeholder="Custo por grama (R$)" value="${valor}" class="mat-valor"></div>
    `;
    list.appendChild(div);
}

window.salvarConfiguracoes = async function() {
    configs.energia = parseFloat(document.getElementById('cfg-energia').value);
    configs.consumo = parseFloat(document.getElementById('cfg-consumo').value);
    configs.maquina = parseFloat(document.getElementById('cfg-maquina').value);
    configs.maoobra = parseFloat(document.getElementById('cfg-maoobra').value);
    configs.margem = parseFloat(document.getElementById('cfg-margem').value);
    configs.embalagem = parseFloat(document.getElementById('cfg-embalagem').value);

    materiais = [];
    document.querySelectorAll('#materiais-list .filamento-row').forEach(row => {
        const cor = row.querySelector('.mat-cor').value;
        const valor = parseFloat(row.querySelector('.mat-valor').value);
        if(cor && !isNaN(valor)) materiais.push({cor, custoGrama: valor});
    });

    try {
        await setDoc(doc(db, "sistema", "configuracoes"), { configs, materiais });
        alert("Configurações salvas no Firebase!");
    } catch (e) {
        console.error("Erro ao salvar config: ", e);
    }
}

// ==========================================
// FUNÇÕES DE PRODUTO E CÁLCULO
// ==========================================

window.adicionarLinhaFilamento = function() {
    const list = document.getElementById('filamentos-list');
    const div = document.createElement('div');
    div.className = 'filamento-row form-row';
    
    let options = materiais.map(m => `<option value="${m.custoGrama}">${m.cor}</option>`).join('');
    
    div.innerHTML = `
        <div class="input-group">
            <select class="prod-fil-cor" onchange="calcularCustoProduto()">
                <option value="0">Selecione a cor</option>
                ${options}
            </select>
        </div>
        <div class="input-group"><input type="number" step="0.1" placeholder="Quantidade (g)" class="prod-fil-qtd" oninput="calcularCustoProduto()"></div>
    `;
    list.appendChild(div);
}

window.calcularCustoProduto = function() {
    let horas = parseFloat(document.getElementById('prod-horas').value) || 0;
    let outros = parseFloat(document.getElementById('prod-outros').value) || 0;

    let custoMaquina = horas * configs.maquina;
    let custoMaoObra = horas * configs.maoobra;
    
    let custoMaterial = 0;
    document.querySelectorAll('#filamentos-list .filamento-row').forEach(row => {
        let custoGrama = parseFloat(row.querySelector('.prod-fil-cor').value) || 0;
        let qtd = parseFloat(row.querySelector('.prod-fil-qtd').value) || 0;
        custoMaterial += (custoGrama * qtd);
    });

    let custoTotal = custoMaterial + custoMaquina + custoMaoObra + configs.embalagem + outros;
    let sugerido = custoTotal * (1 + configs.margem);
    
    document.getElementById('prod-sugerido').value = `R$ ${sugerido.toFixed(2)}`;
    return custoTotal;
}

// === NOVA FUNÇÃO: Limpar o Formulário ===
window.limparFormulario = function() {
    produtoEmEdicaoId = null; // Reseta o ID para o modo "Criar Novo"
    document.getElementById('prod-nome').value = '';
    document.getElementById('prod-foto').value = '';
    document.getElementById('prod-vendidos').value = '0';
    document.getElementById('prod-horas').value = '';
    document.getElementById('prod-qtd').value = '';
    document.getElementById('prod-outros').value = '';
    document.getElementById('prod-cobrado').value = '';
    document.getElementById('prod-sugerido').value = '';
    
    // Limpa a lista de filamentos e adiciona uma linha em branco
    const list = document.getElementById('filamentos-list');
    list.innerHTML = '';
    adicionarLinhaFilamento();
}

// === NOVA FUNÇÃO: Editar Produto ===
window.editarProduto = function(id) {
    // Procura o produto clicado na nossa lista global
    const produto = listaDeProdutos.find(p => p.id === id);
    if (!produto) return;

    // Define que estamos em modo de edição
    produtoEmEdicaoId = id;

    // Preenche as caixas com os dados do produto
    document.getElementById('prod-nome').value = produto.nome || '';
    document.getElementById('prod-foto').value = produto.foto || '';
    document.getElementById('prod-vendidos').value = produto.vendidos || 0;
    document.getElementById('prod-horas').value = produto.horas || '';
    document.getElementById('prod-qtd').value = produto.quantidade || '';
    document.getElementById('prod-outros').value = produto.outros || '';
    document.getElementById('prod-cobrado').value = produto.valorCobrado || '';

    calcularCustoProduto();
    
    // Muda automaticamente para a aba do formulário
    switchTab('novo');
}

window.salvarProduto = async function() {
    const produto = {
        nome: document.getElementById('prod-nome').value,
        foto: document.getElementById('prod-foto').value,
        vendidos: parseInt(document.getElementById('prod-vendidos').value) || 0,
        horas: parseFloat(document.getElementById('prod-horas').value) || 0,
        quantidade: parseInt(document.getElementById('prod-qtd').value) || 0,
        outros: parseFloat(document.getElementById('prod-outros').value) || 0,
        valorCobrado: parseFloat(document.getElementById('prod-cobrado').value) || 0,
        custoCalculado: calcularCustoProduto()
    };

    try {
        if (produtoEmEdicaoId) {
            // Se tiver um ID em edição, ATUALIZA o produto existente
            await updateDoc(doc(db, "produtos", produtoEmEdicaoId), produto);
            alert("Produto atualizado com sucesso!");
        } else {
            // Se não tiver, CRIA um produto novo
            await addDoc(collection(db, "produtos"), produto);
            alert("Produto novo salvo com sucesso!");
        }
        
        limparFormulario(); // Limpa as caixas após salvar
        carregarProdutos(); // Atualiza a lista
        switchTab('produtos'); // Volta para a tela inicial
        
    } catch (e) {
        console.error("Erro ao salvar produto: ", e);
    }
}

async function carregarProdutos() {
    const grid = document.getElementById('products-list');
    grid.innerHTML = 'A carregar...';
    
    const querySnapshot = await getDocs(collection(db, "produtos"));
    grid.innerHTML = '';
    listaDeProdutos = []; // Limpa a lista local
    
    querySnapshot.forEach((doc) => {
        let p = doc.data();
        p.id = doc.id; // Guarda o ID do banco de dados
        listaDeProdutos.push(p); // Adiciona à lista global
        
        let bgStyle = p.foto ? `background-image: url('${p.foto}'); background-color: transparent;` : '';
        let fotoContent = p.foto ? '' : 'Foto';
        
        // Adicionamos o evento onclick para editar ao clicar no cartão
        grid.innerHTML += `
            <div class="product-card" onclick="editarProduto('${p.id}')" style="cursor: pointer;" title="Clique para editar">
                <div class="product-image" style="${bgStyle}">${fotoContent}</div>
                <div class="product-info">
                    <h3>${p.nome || 'Sem Nome'}</h3>
                    <div class="price">R$ ${p.valorCobrado.toFixed(2)}</div>
                    <div class="sales">${p.vendidos} Quantidades Vendidas</div>
                </div>
            </div>
        `;
    });
}

async function init() {
    const docRef = doc(db, "sistema", "configuracoes");
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
        const data = docSnap.data();
        if(data.configs) configs = data.configs;
        if(data.materiais) materiais = data.materiais;
        
        document.getElementById('cfg-energia').value = configs.energia;
        document.getElementById('cfg-consumo').value = configs.consumo;
        document.getElementById('cfg-maquina').value = configs.maquina;
        document.getElementById('cfg-maoobra').value = configs.maoobra;
        document.getElementById('cfg-margem').value = configs.margem;
        document.getElementById('cfg-embalagem').value = configs.embalagem;

        materiais.forEach(m => adicionarLinhaMaterial(m.cor, m.custoGrama));
    } else {
        adicionarLinhaMaterial(); 
    }
    
    limparFormulario(); // Garante que a tela de cadastro inicie limpa
    carregarProdutos();
}

// Removemos a chamada de carregarProdutos() de dentro do init() 
// para que as coisas não dependam uma da outra e não travem.

async function initConfiguracoes() {
    try {
        const docRef = doc(db, "sistema", "configuracoes");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            if(data.configs) configs = data.configs;
            if(data.materiais) materiais = data.materiais;
            
            document.getElementById('cfg-energia').value = configs.energia;
            document.getElementById('cfg-consumo').value = configs.consumo;
            document.getElementById('cfg-maquina').value = configs.maquina;
            document.getElementById('cfg-maoobra').value = configs.maoobra;
            document.getElementById('cfg-margem').value = configs.margem;
            document.getElementById('cfg-embalagem').value = configs.embalagem;

            materiais.forEach(m => adicionarLinhaMaterial(m.cor, m.custoGrama));
        } else {
            adicionarLinhaMaterial(); 
        }
    } catch (error) {
        console.error("Erro ao carregar as configurações:", error);
    }
}

// Inicializa as duas coisas separadamente assim que a página abre
limparFormulario();
initConfiguracoes();
carregarProdutos();
