
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs, doc, setDoc,
  getDoc, updateDoc, deleteDoc, runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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
const auth = getAuth(app);

let configs = {
  energia: 1.5,
  consumo: 0.21,
  maquina: 0.315,
  maoobra: 5,
  margem: 0.4,
  embalagem: 1.5
};

let materiais = [];
let tiposProduto = [];
let produtos = [];
let editId = null;
let vendas = [];

window.switchTab = (tab) => {
  document.querySelectorAll(".tab-content")
    .forEach(x => x.classList.remove("active"));

  document.querySelectorAll(".icon-btn")
    .forEach(x => x.classList.remove("active"));

  document.getElementById("tab-" + tab).classList.add("active");
  document.getElementById("nav-" + tab)?.classList.add("active");

  document.getElementById("search-container").hidden =
    tab !== "produtos";

  if (tab === "estoque") renderEstoque();

  if (tab === "vendas") {
    preencherProdutosVenda();
    renderHistorico();
  }
};

window.novoProduto = () => {
  limparFormulario();
  switchTab("novo");
};

window.adicionarLinhaFilamento = (cor = "0", qtd = "") => {
  const row = document.createElement("div");
  row.className = "filamento-row form-row";

  row.innerHTML = `
    <div class="input-group">
      <select class="prod-fil-cor" onchange="calcularCustoProduto()">
        <option value="0" data-custo="0">Selecione a cor</option>
        ${materiais.map(m => `
          <option value="${escapeHtml(m.cor)}"
            data-custo="${Number(m.custoGrama) || 0}"
            ${m.cor === cor ? "selected" : ""}>
            ${escapeHtml(m.cor)}
          </option>
        `).join("")}
      </select>
    </div>

    <div class="input-group">
      <input class="prod-fil-qtd" type="number" step=".1" min="0"
        placeholder="Quantidade (g)" value="${qtd}"
        oninput="calcularCustoProduto()">
    </div>

    <button class="small-btn"
      onclick="this.parentElement.remove();calcularCustoProduto()">
      <i class="fas fa-trash"></i>
    </button>
  `;

  document.getElementById("filamentos-list").appendChild(row);
};

window.adicionarLinhaMaterial = (cor = "", valor = "") => {
  const d = document.createElement("div");
  d.className = "form-row material-row";

  d.innerHTML = `
    <div class="input-group">
      <input class="mat-cor" placeholder="Cor do filamento"
        value="${escapeAttr(cor)}">
    </div>

    <div class="input-group">
      <input class="mat-valor" type="number" step=".0001"
        placeholder="Custo por grama (R$)" value="${valor}">
    </div>

    <button class="small-btn"
      onclick="this.parentElement.remove()">
      <i class="fas fa-trash"></i>
    </button>
  `;

  document.getElementById("materiais-list").appendChild(d);
};

window.adicionarLinhaTipo = (nome = "") => {
  const d = document.createElement("div");
  d.className = "form-row tipo-row";

  d.innerHTML = `
    <div class="input-group">
      <input class="tipo-nome" placeholder="Nome da categoria"
        value="${escapeAttr(nome)}">
    </div>

    <button class="small-btn"
      onclick="this.parentElement.remove()">
      <i class="fas fa-trash"></i>
    </button>
  `;

  document.getElementById("tipos-list").appendChild(d);
};

window.calcularCustoProduto = () => {
  const horas = +val("prod-horas");
  const outros = +val("prod-outros");
  const cobrado = +val("prod-cobrado");

  let material = 0;

  document.querySelectorAll(".filamento-row").forEach(r => {
    const s = r.querySelector(".prod-fil-cor");

    material +=
      (+(s.selectedOptions[0]?.dataset.custo || 0)) *
      (+r.querySelector(".prod-fil-qtd").value || 0);
  });

  const custo =
    material +
    horas * (+configs.maquina || 0) +
    horas * (+configs.maoobra || 0) +
    (+configs.embalagem || 0) +
    outros;

  document.getElementById("prod-custo-total").value = money(custo);

  document.getElementById("prod-sugerido").value =
    money(custo * (1 + (+configs.margem || 0)));

  document.getElementById("prod-lucro").value =
    money(cobrado - custo);

  return custo;
};

window.limparFormulario = () => {
  editId = null;
  document.getElementById("btn-excluir").hidden = true;

  [
    "prod-foto",
    "prod-codigo",
    "prod-nome",
    "prod-cores",
    "prod-horas",
    "prod-outros",
    "prod-cobrado",
    "prod-custo-total",
    "prod-sugerido",
    "prod-lucro"
  ].forEach(id => {
    document.getElementById(id).value = "";
  });

  document.getElementById("prod-tipo").value = "";
  document.getElementById("prod-licenca").value = "sim";
  document.getElementById("filamentos-list").innerHTML = "";

  adicionarLinhaFilamento();
};

window.editarProduto = (id) => {
  const p = produtos.find(x => x.id === id);
  if (!p) return;

  editId = id;

  const fields = {
    "prod-foto": "foto",
    "prod-codigo": "codigo",
    "prod-nome": "nome",
    "prod-cores": "cores",
    "prod-horas": "horas",
    "prod-outros": "outros",
    "prod-cobrado": "valorCobrado",
    "prod-tipo": "tipo",
    "prod-licenca": "licenca"
  };

  Object.entries(fields).forEach(([el, k]) => {
    document.getElementById(el).value =
      k === "cores"
        ? (p.cores || []).join(", ")
        : (p[k] ?? "");
  });

  document.getElementById("btn-excluir").hidden = false;
  document.getElementById("filamentos-list").innerHTML = "";

  if ((p.filamentosUsados || []).length) {
    p.filamentosUsados.forEach(f => {
      adicionarLinhaFilamento(f.cor, f.quantidade);
    });
  } else {
    adicionarLinhaFilamento();
  }

  calcularCustoProduto();
  switchTab("novo");
};

window.salvarProduto = async () => {
  const nome = val("prod-nome").trim();

  if (!nome) {
    alert("Informe o nome do produto.");
    return;
  }

  const filamentosUsados = [
    ...document.querySelectorAll(".filamento-row")
  ].map(r => ({
    cor: r.querySelector(".prod-fil-cor").value,
    quantidade: +r.querySelector(".prod-fil-qtd").value || 0,
    custoGrama:
      +r.querySelector(".prod-fil-cor").selectedOptions[0]?.dataset.custo || 0
  })).filter(f => f.cor !== "0" && f.quantidade > 0);

  const cores = [
    ...new Set(
      val("prod-cores")
        .split(",")
        .map(x => x.trim())
        .filter(Boolean)
    )
  ];

  const antigo = produtos.find(p => p.id === editId);

  const produto = {
    nome,
    codigo: val("prod-codigo").trim(),
    tipo: val("prod-tipo"),
    foto: val("prod-foto").trim(),
    cores,
    horas: +val("prod-horas") || 0,
    outros: +val("prod-outros") || 0,
    valorCobrado: +val("prod-cobrado") || 0,
    licenca: val("prod-licenca"),
    custoCalculado: calcularCustoProduto(),
    filamentosUsados,
    vendidos: antigo?.vendidos || 0,
    estoquePorCor: antigo?.estoquePorCor || {},
    quantidade: antigo?.quantidade || 0
  };

  // Mantém o estoque já registrado e cria saldo zero para cores novas.
  cores.forEach(c => {
    if (produto.estoquePorCor[c] == null) {
      produto.estoquePorCor[c] = 0;
    }
  });

  try {
    if (editId) {
      await updateDoc(doc(db, "produtos", editId), produto);
    } else {
      await addDoc(collection(db, "produtos"), produto);
    }

    alert("Produto salvo com sucesso!");
    limparFormulario();
    await carregarProdutos();
    switchTab("produtos");
  } catch (e) {
    console.error(e);
    alert("Não foi possível salvar o produto. Confira a conexão e as regras do Firebase.");
  }
};

window.excluirProduto = async () => {
  if (!editId || !confirm("Deseja excluir este produto?")) return;

  try {
    await deleteDoc(doc(db, "produtos", editId));
    limparFormulario();
    await carregarProdutos();
    switchTab("produtos");
  } catch (e) {
    alert("Erro ao excluir produto.");
  }
};

window.filtrarProdutos = () => {
  const term = val("search-input").toLowerCase();
  const tipo = val("search-tipo");

  const filtered = produtos
    .filter(p =>
      (p.nome || "").toLowerCase().includes(term) ||
      (p.codigo || "").toLowerCase().includes(term) &&
      (tipo === "todos" || p.tipo === tipo)
    )
    .filter(p => tipo === "todos" || p.tipo === tipo);

  renderProdutos(filtered);
};

function renderProdutos(arr = produtos) {
  const grid = document.getElementById("products-list");
  grid.innerHTML = "";

  if (!arr.length) {
    grid.innerHTML = '<p class="muted">Nenhum produto encontrado.</p>';
    return;
  }

  arr.forEach(p => {
    const card = document.createElement("article");
    card.className = "product-card";
    card.onclick = () => editarProduto(p.id);

    const img = document.createElement("div");
    img.className = "product-image";

    if (p.foto) {
      img.style.backgroundImage =
        `url("${p.foto.replace(/"/g, "%22")}")`;
    } else {
      img.textContent = "Foto";
    }

    const info = document.createElement("div");
    info.className = "product-info";

    info.innerHTML = `
      <div class="tags">
        <span class="tag ${p.licenca === "nao" ? "red" : "blue"}">
          ${p.licenca === "nao" ? "Uso pessoal" : "Venda liberada"}
        </span>

        ${p.codigo
          ? `<span class="tag">${escapeHtml(p.codigo)}</span>`
          : ""}

        ${p.tipo
          ? `<span class="tag">${escapeHtml(p.tipo)}</span>`
          : ""}
      </div>

      <h3>${escapeHtml(p.nome || "Sem nome")}</h3>
      <div class="price">${money(p.valorCobrado || 0)}</div>
      <div class="sales">${p.vendidos || 0} unidades vendidas</div>
      <div class="muted">Em estoque: ${totalStock(p)}</div>

      <div class="colors">
        ${(p.cores || []).map(c =>
          `<span class="color-label">${escapeHtml(c)}</span>`
        ).join("")}
      </div>
    `;

    card.append(img, info);
    grid.append(card);
  });
}

function totalStock(p) {
  if (p.estoquePorCor && Object.keys(p.estoquePorCor).length) {
    return Object.values(p.estoquePorCor)
      .reduce((a, b) => a + (+b || 0), 0);
  }

  return +p.quantidade || 0;
}

function renderEstoque() {
  const body = document.getElementById("stock-list");
  body.innerHTML = "";

  produtos.forEach(p => {
    const colors = p.cores?.length ? p.cores : ["Sem cor"];

    // Compatibilidade com produtos antigos que tinham quantidade cadastrada.
    colors.forEach((c, i) => {
      let qty = p.estoquePorCor?.[c];

      if (qty == null) {
        qty = i === 0 ? (+p.quantidade || 0) : 0;
      }

      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${escapeHtml(p.nome)}</td>
        <td>${escapeHtml(c)}</td>
        <td><strong>${qty}</strong></td>

        <td>
          <input type="number" min="1" step="1"
            class="stock-entry"
            aria-label="Quantidade para adicionar ao estoque">
        </td>

        <td>
          <button class="table-btn"
            data-id="${p.id}"
            data-color="${escapeAttr(c)}">
            Adicionar entrada
          </button>
        </td>
      `;

      tr.querySelector("button").onclick = () => {
        entradaEstoque(p.id, c, tr.querySelector("input").value);
      };

      body.append(tr);
    });
  });

  if (!body.children.length) {
    body.innerHTML =
      '<tr><td colspan="5">Nenhum produto cadastrado.</td></tr>';
  }
}

async function entradaEstoque(id, cor, quantidade) {
  const n = Math.floor(+quantidade);

  if (!Number.isInteger(n) || n < 1) {
    alert("Informe uma quantidade de entrada maior que zero.");
    return;
  }

  try {
    const ref = doc(db, "produtos", id);

    await runTransaction(db, async tx => {
      const snap = await tx.get(ref);

      if (!snap.exists()) {
        throw Error("Produto não encontrado");
      }

      const p = snap.data();
      const stock = { ...(p.estoquePorCor || {}) };

      stock[cor] =
        (stock[cor] == null
          ? (cor === "Sem cor" ? (+p.quantidade || 0) : 0)
          : +stock[cor]) + n;

      tx.update(ref, {
        estoquePorCor: stock,
        quantidade: Object.values(stock)
          .reduce((a, b) => a + (+b || 0), 0)
      });
    });

    await carregarProdutos();
    renderEstoque();
    alert("Entrada registrada. Estoque atualizado.");
  } catch (e) {
    console.error(e);
    alert("Não foi possível atualizar o estoque.");
  }
}

function preencherProdutosVenda() {
  const s = document.getElementById("sale-product");
  const old = s.value;

  s.innerHTML = '<option value="">Selecione o produto</option>';

  produtos.forEach(p => {
    const o = document.createElement("option");
    o.value = p.id;
    o.textContent = p.nome;
    s.append(o);
  });

  if (produtos.some(p => p.id === old)) {
    s.value = old;
  }

  atualizarCoresVenda();
}

window.atualizarCoresVenda = () => {
  const p = produtos.find(x => x.id === val("sale-product"));
  const s = document.getElementById("sale-color");

  s.innerHTML = "";

  (p?.cores?.length ? p.cores : ["Sem cor"]).forEach(c => {
    const o = document.createElement("option");
    o.value = c;
    o.textContent =
      `${c} — disponível: ${
        p?.estoquePorCor?.[c] ??
        (c === "Sem cor" ? p?.quantidade || 0 : 0)
      }`;
    s.append(o);
  });

  document.getElementById("sale-price").value =
    p?.valorCobrado ?? "";
};

window.registrarVenda = async () => {
  const id = val("sale-product");
  const cor = val("sale-color");
  const q = Math.floor(+val("sale-quantity"));
  const preco = +val("sale-price");
  const nota = val("sale-note").trim();

  if (!id || !cor || q < 1 || !Number.isInteger(q) || preco < 0) {
    alert("Selecione produto e cor, e informe quantidade e preço válidos.");
    return;
  }

  const ref = doc(db, "produtos", id);

  try {
    let nomeProduto = "";

    await runTransaction(db, async tx => {
      const snap = await tx.get(ref);

      if (!snap.exists()) {
        throw Error("Produto não encontrado");
      }

      const p = snap.data();
      nomeProduto = p.nome;

      const stock = { ...(p.estoquePorCor || {}) };
      let disponivel = stock[cor];

      if (disponivel == null) {
        disponivel =
          cor === "Sem cor" ? (+p.quantidade || 0) : 0;
      }

      if (disponivel < q) {
        throw Error(`Estoque insuficiente. Disponível: ${disponivel}`);
      }

      stock[cor] = disponivel - q;

      tx.update(ref, {
        estoquePorCor: stock,
        quantidade: Object.values(stock)
          .reduce((a, b) => a + (+b || 0), 0),
        vendidos: (+p.vendidos || 0) + q
      });
    });

    await addDoc(collection(db, "vendas"), {
      produtoId: id,
      produto: nomeProduto,
      cor,
      quantidade: q,
      valorUnitario: preco,
      total: q * preco,
      observacao: nota,
      data: Date.now()
    });

    document.getElementById("sale-quantity").value = 1;
    document.getElementById("sale-note").value = "";

    await carregarProdutos();
    preencherProdutosVenda();
    await renderHistorico();

    alert("Venda registrada e estoque reduzido com sucesso.");
  } catch (e) {
    console.error(e);

    alert(
      e.message?.startsWith("Estoque insuficiente")
        ? e.message
        : "Não foi possível registrar a venda. Confira sua conexão e as regras do Firebase."
    );
  }
};

async function renderHistorico() {
  const body = document.getElementById("sales-history");
  body.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>';

  try {
    const snap = await getDocs(collection(db, "vendas"));

    vendas = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.data || 0) - (a.data || 0));

    body.innerHTML = "";

    vendas.forEach(v => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${v.data
          ? new Date(v.data).toLocaleString("pt-BR")
          : "—"}</td>
        <td>${escapeHtml(v.produto || "")}</td>
        <td>${escapeHtml(v.cor || "")}</td>
        <td>${v.quantidade || 0}</td>
        <td>${money(v.total || 0)}</td>
        <td>${escapeHtml(v.observacao || "")}</td>
      `;

      body.append(tr);
    });

    if (!body.children.length) {
      body.innerHTML =
        '<tr><td colspan="6">Nenhuma venda registrada.</td></tr>';
    }
  } catch (e) {
    body.innerHTML =
      '<tr><td colspan="6">Não foi possível carregar o histórico.</td></tr>';

    console.error(e);
  }
}

window.salvarConfiguracoes = async () => {
  configs = {
    energia: +val("cfg-energia"),
    consumo: +val("cfg-consumo"),
    maquina: +val("cfg-maquina"),
    maoobra: +val("cfg-maoobra"),
    margem: +val("cfg-margem"),
    embalagem: +val("cfg-embalagem")
  };

  materiais = [
    ...document.querySelectorAll(".material-row")
  ].map(r => ({
    cor: r.querySelector(".mat-cor").value.trim(),
    custoGrama: +r.querySelector(".mat-valor").value
  })).filter(m => m.cor);

  tiposProduto = [
    ...document.querySelectorAll(".tipo-row")
  ].map(r => r.querySelector(".tipo-nome").value.trim())
    .filter(Boolean);

  try {
    await setDoc(doc(db, "sistema", "configuracoes"), {
      configs,
      materiais,
      tiposProduto
    });

    atualizarSelectsTipos();
    alert("Configurações salvas.");
  } catch (e) {
    alert("Erro ao salvar configurações.");
  }
};

function atualizarSelectsTipos() {
  const p = document.getElementById("prod-tipo");
  const s = document.getElementById("search-tipo");
  const pv = p.value;
  const sv = s.value;

  p.innerHTML = '<option value="">Selecione o tipo</option>';
  s.innerHTML = '<option value="todos">Todos os tipos</option>';

  tiposProduto.forEach(t => {
    p.add(new Option(t, t));
    s.add(new Option(t, t));
  });

  p.value = pv;
  s.value = sv || "todos";
}

async function carregarProdutos() {
  try {
    const snap = await getDocs(collection(db, "produtos"));

    produtos = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    renderProdutos();
    renderEstoque();
  } catch (e) {
    console.error(e);

    document.getElementById("products-list").textContent =
      "Erro ao carregar produtos.";
  }
}

async function initConfiguracoes() {
  try {
    const snap = await getDoc(doc(db, "sistema", "configuracoes"));

    if (snap.exists()) {
      const d = snap.data();

      configs = { ...configs, ...d.configs };
      materiais = d.materiais || [];
      tiposProduto = d.tiposProduto || [];
    }

    Object.entries({
      energia: "cfg-energia",
      consumo: "cfg-consumo",
      maquina: "cfg-maquina",
      maoobra: "cfg-maoobra",
      margem: "cfg-margem",
      embalagem: "cfg-embalagem"
    }).forEach(([k, id]) => {
      document.getElementById(id).value = configs[k];
    });

    materiais.forEach(m => adicionarLinhaMaterial(m.cor, m.custoGrama));

    if (!materiais.length) {
      adicionarLinhaMaterial();
    }

    tiposProduto.forEach(t => adicionarLinhaTipo(t));

    if (!tiposProduto.length) {
      adicionarLinhaTipo();
    }

    atualizarSelectsTipos();
    limparFormulario();
  } catch (e) {
    console.error(e);
  }
}

window.fazerLogin = async () => {
  try {
    await signInWithEmailAndPassword(
      auth,
      val("login-email"),
      val("login-senha")
    );

    document.getElementById("login-erro").hidden = true;
  } catch (e) {
    document.getElementById("login-erro").hidden = false;
  }
};

onAuthStateChanged(auth, async user => {
  document.getElementById("login-screen").hidden = !!user;
  document.getElementById("main-app").hidden = !user;

  if (user) {
    await initConfiguracoes();
    await carregarProdutos();
  }
});

function val(id) {
  return document.getElementById(id).value;
}

function money(n) {
  return Number(n || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function escapeHtml(s = "") {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function escapeAttr(s = "") {
  return escapeHtml(s);
}
