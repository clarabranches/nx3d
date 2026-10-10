// Importando o SDK do Firebase via CDN (Módulos)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, getDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let configs = {
    energia: 1.5,
    consumo: 0.21,
    maquina: 0.315,
    maoobra: 5.0,
    margem: 0.4,
    embalagem: 1.5
};

let materiais = []; 
let tiposProduto = []; // NOVA VARIÁVEL: Lista de tipos cadastrados
let listaDeProdutos = []; 
let produtoEmEdicaoId = null; 

// ==========================================
// CONFIGURAÇÕES, TIPOS E MATERIAIS
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

// NOVA FUNÇÃO: Adicionar linha para Tipos de Produto
window.adicionarLinhaTipo = function(nome = "") {
    const list = document.getElementById('tipos-list');
    const div = document.createElement('div');
    div.className = 'tipo-row form-row';
    div.style.alignItems = "flex-end";
    div.innerHTML = `
        <div class="input-group"><input type="text" placeholder="Nome do Tipo (Ex: Action Figure, Vaso)" value="${nome}" class="tipo-nome"></div>
        <button class="action-btn clear-btn" onclick="this.parentElement.remove()" style="margin-bottom: 5px;"><i class="fas fa-trash"></i></button>
    `;
    list.appendChild(div);
}

// NOVA FUNÇÃO: Atualizar os dropdowns (selects) de tipos nas outras abas
window.atualizarSelectsTipos = function() {
    const prodTipo = document.getElementById('prod-tipo');
    const searchTipo = document.getElementById('search-tipo');

    // Mantém seleção atual caso exista
    const currentProdTipo = prodTipo.value;
    const currentSearchTipo = searchTipo.value;

    prodTipo.innerHTML = '<option value="">Selecione o tipo</option>';
    searchTipo.innerHTML = '<option value="todos" style="color: #000;">Todos os Tipos</option>';

    tiposProduto.forEach(t => {
        prodTipo.innerHTML += `<option value="${t}">${t}</option>`;
        searchTipo.innerHTML += `<option value="${t}" style="color: #000;">${t}</option>`;
    });

    prodTipo.value = currentProdTipo || "";
    searchTipo.value = currentSearchTipo || "todos";
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

    // Salvar Tipos de Produtos
    tiposProduto = [];
    document.querySelectorAll('#tipos-list .tipo-row').forEach(row => {
        const nome = row.querySelector('.tipo-nome').value.trim();
        if(nome) tiposProduto.push(nome);
    });

    try {
        await setDoc(doc(db, "sistema", "configuracoes"), { configs, materiais, tiposProduto });
        atualizarSelectsTipos(); // Atualiza os menus suspensos imediatamente
        alert("Configurações e Tipos salvos no Firebase!");
    } catch (e) {
        console.error("Erro ao salvar config: ", e);
    }
}

// ==========================================
// PRODUTOS
// ==========================================

window.adicionarLinhaFilamento = function(corSelecionada = "0", qtdSeta = "") {
    const list = document.getElementById('filamentos-list');
    const div = document.createElement('div');
    div.className = 'filamento-row form-row';
    
    const corSelecionadaStr = corSelecionada.toString();

    let options = materiais.map(m => {
        let selected = (m.cor === corSelecionadaStr) ? "selected" : "";
        return `<option value="${m.cor}" data-custo="${m.custoGrama}" ${selected}>${m.cor}</option>`;
    }).join('');
    
    div.innerHTML = `
        <div class="input-group">
            <select class="prod-fil-cor" onchange="calcularCustoProduto()">
                <option value="0" data-custo="0">Selecione a cor</option>
                ${options}
            </select>
        </div>
        <div class="input-group"><input type="number" step="0.1" placeholder="Quantidade (g)" value="${qtdSeta}" class="prod-fil-qtd" oninput="calcularCustoProduto()"></div>
    `;
    list.appendChild(div);
}

window.calcularCustoProduto = function() {
    let horas = parseFloat(document.getElementById('prod-horas').value) || 0;
    let outros = parseFloat(document.getElementById('prod-outros').value) || 0;
    let valorCobrado = parseFloat(document.getElementById('prod-cobrado').value) || 0;

    let custoMaquina = horas * configs.maquina;
    let custoMaoObra = horas * configs.maoobra;
    
    let custoMaterial = 0;
    document.querySelectorAll('#filamentos-list .filamento-row').forEach(row => {
        const selectCor = row.querySelector('.prod-fil-cor');
        const opcaoSelecionada = selectCor.options[selectCor.selectedIndex];
        let custoGrama = parseFloat(opcaoSelecionada.getAttribute('data-custo')) || 0;
        let qtd = parseFloat(row.querySelector('.prod-fil-qtd').value) || 0;
        custoMaterial += (custoGrama * qtd);
    });

    let custoTotal = custoMaterial + custoMaquina + custoMaoObra + configs.embalagem + outros;
    let sugerido = custoTotal * (1 + configs.margem);
    let lucro = valorCobrado - custoTotal;
    
    document.getElementById('prod-custo-total').value = `R$ ${custoTotal.toFixed(2)}`;
    document.getElementById('prod-sugerido').value = `R$ ${sugerido.toFixed(2)}`;
    
    const lucroInput = document.getElementById('prod-lucro');
    lucroInput.value = `R$ ${lucro.toFixed(2)}`;
    if (lucro < 0) {
        lucroInput.style.color = '#d32f2f'; 
    } else {
        lucroInput.style.color = '#2e7d32'; 
    }

    return custoTotal;
}

window.limparFormulario = function() {
    produtoEmEdicaoId = null; 
    document.getElementById('btn-excluir').style.display = 'none';

    document.getElementById('prod-nome').value = '';
    document.getElementById('prod-codigo').value = ''; // Limpa código
    document.getElementById('prod-tipo').value = '';   // Limpa tipo
    document.getElementById('prod-foto').value = '';
    document.getElementById('prod-vendidos').value = '0';
    document.getElementById('prod-horas').value = '';
    document.getElementById('prod-qtd').value = '';
    document.getElementById('prod-outros').value = '';
    document.getElementById('prod-cobrado').value = '';
    document.getElementById('prod-sugerido').value = '';
    document.getElementById('prod-custo-total').value = '';
    document.getElementById('prod-lucro').value = '';
    document.getElementById('prod-licenca').value = 'sim'; 
    
    const list = document.getElementById('filamentos-list');
    list.innerHTML = '';
    adicionarLinhaFilamento(); 
}

window.editarProduto = function(id) {
    const produto = listaDeProdutos.find(p => p.id === id);
    if (!produto) return;

    produtoEmEdicaoId = id;
    document.getElementById('btn-excluir').style.display = 'block'; 

    document.getElementById('prod-nome').value = produto.nome || '';
    document.getElementById('prod-codigo').value = produto.codigo || ''; // Carrega código
    document.getElementById('prod-tipo').value = produto.tipo || '';     // Carrega tipo
    document.getElementById('prod-foto').value = produto.foto || '';
    document.getElementById('prod-vendidos').value = produto.vendidos || 0;
    document.getElementById('prod-horas').value = produto.horas || '';
    document.getElementById('prod-qtd').value = produto.quantidade || '';
    document.getElementById('prod-outros').value = produto.outros || '';
    document.getElementById('prod-cobrado').value = produto.valorCobrado || '';
    document.getElementById('prod-licenca').value = produto.licenca || 'sim';

    const list = document.getElementById('filamentos-list');
    list.innerHTML = '';

    if (produto.filamentosUsados && produto.filamentosUsados.length > 0) {
        produto.filamentosUsados.forEach(f => {
            adicionarLinhaFilamento(f.cor, f.quantidade);
        });
    } else {
        adicionarLinhaFilamento(); 
    }

    calcularCustoProduto();
    switchTab('novo');
}

window.excluirProduto = async function() {
    if (!produtoEmEdicaoId) return;

    const confirmacao = confirm("Tem certeza que deseja apagar este produto definitivamente?");
    if (confirmacao) {
        try {
            await deleteDoc(doc(db, "produtos", produtoEmEdicaoId));
            alert("Produto excluído com sucesso!");
            limparFormulario();
            carregarProdutos();
            switchTab('produtos');
        } catch (error) {
            console.error("Erro ao excluir produto:", error);
            alert("Erro ao excluir.");
        }
    }
}

window.salvarProduto = async function() {
    let filamentosUsados = [];
    document.querySelectorAll('#filamentos-list .filamento-row').forEach(row => {
        const selectCor = row.querySelector('.prod-fil-cor');
        const opcaoSelecionada = selectCor.options[selectCor.selectedIndex];
        
        let nomeCor = selectCor.value; 
        let custoGrama = parseFloat(opcaoSelecionada.getAttribute('data-custo')) || 0;
        let qtd = parseFloat(row.querySelector('.prod-fil-qtd').value) || 0;
        
        if (nomeCor !== "0" && qtd > 0) {
            filamentosUsados.push({ cor: nomeCor, custoGrama: custoGrama, quantidade: qtd });
        }
    });

    const produto = {
        nome: document.getElementById('prod-nome').value,
        codigo: document.getElementById('prod-codigo').value, // Salva código
        tipo: document.getElementById('prod-tipo').value,     // Salva tipo
        foto: document.getElementById('prod-foto').value,
        vendidos: parseInt(document.getElementById('prod-vendidos').value) || 0,
        horas: parseFloat(document.getElementById('prod-horas').value) || 0,
        quantidade: parseInt(document.getElementById('prod-qtd').value) || 0,
        outros: parseFloat(document.getElementById('prod-outros').value) || 0,
        valorCobrado: parseFloat(document.getElementById('prod-cobrado').value) || 0,
        licenca: document.getElementById('prod-licenca').value, 
        custoCalculado: calcularCustoProduto(),
        filamentosUsados: filamentosUsados 
    };

    try {
        if (produtoEmEdicaoId) {
            await updateDoc(doc(db, "produtos", produtoEmEdicaoId), produto);
            alert("Produto atualizado com sucesso!");
        } else {
            await addDoc(collection(db, "produtos"), produto);
            alert("Produto novo salvo com sucesso!");
        }
        
        limparFormulario();
        carregarProdutos();
        switchTab('produtos');
        
    } catch (e) {
        console.error("Erro ao salvar produto: ", e);
    }
}

// NOVA FUNÇÃO: Renderizar Grid de Produtos a partir de um Array (útil para filtro)
window.renderizarProdutosLista = function(arrayDeProdutos) {
    const grid = document.getElementById('products-list');
    grid.innerHTML = '';
    
    if(arrayDeProdutos.length === 0) {
        grid.innerHTML = '<p style="color: #fff; padding: 20px;">Nenhum produto encontrado com este filtro.</p>';
        return;
    }

    arrayDeProdutos.forEach((p) => {
        let bgStyle = p.foto ? `background-image: url('${p.foto}'); background-color: transparent;` : '';
        let fotoContent = p.foto ? '' : 'Foto';
        
        let tagLicencaHTML = '';
        if (p.licenca === 'nao') {
            tagLicencaHTML = '<span class="tag-licenca tag-sem-licenca"><i class="fas fa-ban"></i> Uso Pessoal</span>';
        } else {
            tagLicencaHTML = '<span class="tag-licenca tag-comercial"><i class="fas fa-check-circle"></i> Venda Liberada</span>';
        }
        
        // Tags extras de código e tipo
        let tagCodigo = p.codigo ? `<span class="tag-licenca tag-info">${p.codigo}</span>` : '';
        let tagTipo = p.tipo ? `<span class="tag-licenca tag-info">${p.tipo}</span>` : '';
        
        grid.innerHTML += `
            <div class="product-card" onclick="editarProduto('${p.id}')" style="cursor: pointer;" title="Clique para editar">
                <div class="product-image" style="${bgStyle}">${fotoContent}</div>
                <div class="product-info">
                    <div style="margin-bottom: 5px;">${tagLicencaHTML} ${tagCodigo} ${tagTipo}</div>
                    <h3>${p.nome || 'Sem Nome'}</h3>
                    <div class="price">R$ ${(p.valorCobrado || 0).toFixed(2)}</div>
                    <div class="sales">${p.vendidos} Quantidades Vendidas</div>
                </div>
            </div>
        `;
    });
}

// NOVA FUNÇÃO: Disparada ao digitar na busca ou alterar o select de tipo
// NOVA FUNÇÃO ATUALIZADA: Filtro + Ordenação por Preço e Lucro
window.filtrarProdutos = function() {
    const termoBusca = document.getElementById('search-input').value.toLowerCase();
    const tipoFiltro = document.getElementById('search-tipo').value;
    const ordenacao = document.getElementById('sort-tipo').value; // Pega o valor da ordenação

    // 1. Primeiro filtra quem deve aparecer (por texto ou tipo)
    let filtrados = listaDeProdutos.filter(p => {
        const nomeUpper = (p.nome || '').toLowerCase();
        const codigoUpper = (p.codigo || '').toLowerCase();
        
        // Verifica se o texto digitado bate com nome ou código
        const matchTexto = nomeUpper.includes(termoBusca) || codigoUpper.includes(termoBusca);
        // Verifica se o select de tipo bate com o tipo salvo
        const matchTipo = (tipoFiltro === 'todos') || (p.tipo === tipoFiltro);
        
        return matchTexto && matchTipo;
    });

    // 2. Depois aplica a regra de ordenação na lista já filtrada
    if (ordenacao === 'preco-maior') {
        // Ordena do maior valor cobrado para o menor
        filtrados.sort((a, b) => (b.valorCobrado || 0) - (a.valorCobrado || 0));
    } 
    else if (ordenacao === 'preco-menor') {
        // Ordena do menor valor cobrado para o maior
        filtrados.sort((a, b) => (a.valorCobrado || 0) - (b.valorCobrado || 0));
    } 
    else if (ordenacao === 'lucro-maior') {
        // Calcula o lucro em tempo real (Venda - Custo) e ordena pelo maior lucro
        filtrados.sort((a, b) => {
            const lucroA = (a.valorCobrado || 0) - (a.custoCalculado || 0);
            const lucroB = (b.valorCobrado || 0) - (b.custoCalculado || 0);
            return lucroB - lucroA;
        });
    }

    // 3. Renderiza a lista na tela com o filtro e a ordem aplicados
    renderizarProdutosLista(filtrados);
}

async function carregarProdutos() {
    const grid = document.getElementById('products-list');
    grid.innerHTML = 'A carregar...';
    
    try {
        const querySnapshot = await getDocs(collection(db, "produtos"));
        listaDeProdutos = []; 
        
        querySnapshot.forEach((doc) => {
            let p = doc.data();
            p.id = doc.id; 
            listaDeProdutos.push(p); 
        });

        // Limpa inputs de pesquisa ao recarregar a lista geral
        document.getElementById('search-input').value = '';
        document.getElementById('search-tipo').value = 'todos';
        document.getElementById('sort-tipo').value = 'padrao';
        
        renderizarProdutosLista(listaDeProdutos);

    } catch (e) {
        console.error("Erro ao carregar produtos:", e);
        grid.innerHTML = 'Erro ao carregar os produtos.';
    }
}

async function initConfiguracoes() {
    try {
        const docRef = doc(db, "sistema", "configuracoes");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            if(data.configs) configs = data.configs;
            if(data.materiais) materiais = data.materiais;
            if(data.tiposProduto) tiposProduto = data.tiposProduto; // Carrega os Tipos
            
            document.getElementById('cfg-energia').value = configs.energia;
            document.getElementById('cfg-consumo').value = configs.consumo;
            document.getElementById('cfg-maquina').value = configs.maquina;
            document.getElementById('cfg-maoobra').value = configs.maoobra;
            document.getElementById('cfg-margem').value = configs.margem;
            document.getElementById('cfg-embalagem').value = configs.embalagem;

            materiais.forEach(m => adicionarLinhaMaterial(m.cor, m.custoGrama));
            
            if(tiposProduto && tiposProduto.length > 0) {
                tiposProduto.forEach(t => adicionarLinhaTipo(t));
            } else {
                adicionarLinhaTipo(); 
            }
        } else {
            adicionarLinhaMaterial(); 
            adicionarLinhaTipo();
        }
        atualizarSelectsTipos(); // Preenche os dropdowns da interface
    } catch (error) {
        console.error("Erro ao carregar as configurações:", error);
    }
}

limparFormulario();
initConfiguracoes();
carregarProdutos();
