const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const emails = [
  'monique_britoo@hotmail.com', 'danielmsil.jur@gmail.com', 'kaio.augustor8@gmail.com', 'ferramentaskomp@gmail.com',
  'daviferraz6@protonmail.com', 'grs.business2020@gmail.com', 'thiagofernandes.design@gmail.com', 'henriqueconstrumic@gmail.com',
  'xxcaio42@gmail.com', 'andradeproducoesdigitais@gmail.com', 'ivanpgeneral@gmail.com', 'lercardoso@gmail.com',
  'lucca-ferrari@hotmail.com', 'sgovenehs@gmail.com', 'andersonjpl10@gmail.com', 'alexbrecailo@gmail.com',
  'marlonivankio@gmail.com', 'nenyfernandes524@gmail.com', 'kaiorodriguestrader@gmail.com', 'manouelacarvalho@hotmail.com',
  'jose.c4rlos.junior@gmail.com', 'betoveroneze@gmail.com', 'eas2104@gmail.com', 'lucasbrazcaetano333@gmail.com',
  'frankpessoa@gmail.com', 'kaskation@gmail.com', 'siqueirawhelisson@gmail.com', 'raphaelteixeira77@gmail.com',
  'ronaldomaia07@hotmail.com', 'luispaulo.chaves2025@outlook.com', 'tinholiveira19@gmail.com', 'malbonettk@gmail.com',
  'vera.medina1@gmail.com', 'kaynsantosbusiness@gmail.com', 'igornathandejesus@gmail.com', 'lucasdantas00jp@gmail.com',
  'ricardoavm1306@hotmail.com', 'caio.santana@outlook.com', 'ecarmouza@gmail.com', 'falecom@thiagosantana.com.br',
  'leandrogetulio45@gmail.com', 'raizesemharmonia@gmail.com', 'dcconsultingbrasil@gmail.com', 'faladudu@hotmail.com',
  'faladudu@gmail.com', 'vitorguerra90@gmail.com', 'sr.patrickpersonal7@gmail.com', 'orlando.jva@gmail.com',
  'leonardorodrigues9872@gmail.com', 'airtonkokubu2102@gmail.com', 'polianaxk15@gmail.com', 'alexandresegecic111@gmail.com',
  'empresario.murilogoulart@gmail.com', 'planejadosaiala@gmail.com', 'assessoriaeagcompany@gmail.com', 'tonmattos.wm@gmail.com',
  'kenny_330@msn.com', 'duocriavideo@gmail.com', 'micaelpedrosoares@gmail.com', 'dacroty@gmail.com',
  'marcelo.bastos33a@gmail.com', 'jeanterr@gmail.com', 'geral@madeira-adventure-kingdom.com', 'v.anjos1@protonmail.com',
  'rivaraul@gmail.com', 'juanlourencosantos@gmail.com', 'mauschmidt78@gmail.com', 'harrisonsoares@proton.me',
  'dantasvinnie@gmail.com', 'alphavt7@gmail.com', 'emotticontabilidade@gmail.com', 'serafiim.bruno@hotmail.com',
  'lucasimbobjj@gmail.com', 'euriler@arka.education', 'moraispereirajp@gmail.com', 'davicneto77@gmail.com',
  'prof.thiagolm@gmail.com', 'oniasoics@gmail.com', 'jeffersonbrandao2000@gmail.com', 'nickbelo@gmail.com',
  'julio.oliveiracf@gmail.com', 'mab0402@gmail.com', 'sd_fontes@hotmail.com', 'joaomarcosfidelis1999@gmail.com',
  'eduardosantos5421@gmail.com', 'rubnet2@gmail.com', 'thaleseditions@gmail.com', 'stefanodepaula@gmail.com',
  'stephanscaravelli@gmail.com', 'henriquecaramez@gmail.com', 'carolinacassy@yahoo.com.br', 'victor@agenciapraia.com',
  'luamlap27.9@gmail.com', 'pedromachado0303@gmail.com', 'castellano.chico@gmail.com', 'francamatheus406@gmail.com',
  'lu.cas.20@hotmail.com', 'eaglemind.mkt@gmail.com', 'augustoleandro@gmail.com', 'alisson@bertochi.com.br',
  'fernando.bortolazzo@outlook.com', 'lhiniket@gmail.com', 'lucas.valladao@gmail.com', 'felipemelo.art@gmail.com',
  'jovemffej@gmail.com', 'rf90963@gmail.com', 'sadriano@yahoo.com', 'ihitturco@gmail.com',
  'lucascorporativo1982@gmail.com', 'paulodoheitorgarcia@gmail.com', 'jalvarojr@outlook.com', 'renan.merlone@gmail.com',
  'brunoandante@gmail.com', 'iury_lucas@hotmail.com', 'rafinhasantosfernandes2015@gmail.com', 'machadopontes@gmail.com',
  'muriloqueirantes@gmail.com', 'adryanawdc016@gmail.com', 'harrisonorquestradorde.ia@gmail.com', 'thiagobatista183@gmail.com',
  'eddite@masteralimentos.com', 'richardmezari@gmail.com', 'bruce0097@gmail.com', 'fnflores01@gmail.com',
  'mauriciovs.ti@gmail.com', 'lucassantos060901@gmail.com', 'metalomega@gmail.com', 'likasassaki@gmail.com',
  'jonathas2@hotmail.com', 'jonesmartins1983@gmail.com', 'samuel.arq@gmail.com', 'juca_79@yahoo.com.br',
  'vilela.gabriel2@gmail.com', 'richardsifrajoaquim@gmail.com', 'mcn.willian@hotmail.com', 'inxvz7@gmail.com',
  'lucca.xt@outlook.com', 'klayton.10000.cf@gmail.com', 'geazi.henrique@gmail.com', 'gustavostriolo@gmail.com',
  'mendes.gui59@gmail.com', 'redcavok@gmail.com', 'thyzineo+abrahub@gmail.com', 'nrphenix@gmail.com',
  'viverdeencapsulados@gmail.com', 'andrewmsramos@gmail.com', 'sales_jp@hotmail.com', 'navarro01001@gmail.com',
  'rickmarssal_007@hotmail.com', 'vini.ciuscosta@yahoo.com.br', 'joaovicentemaneiro@gmail.com', 'sales.fisico@gmail.com',
  'fabiojpweb@gmail.com', 'wevergton.hs@gmail.com', 'erismarmesquita@gmail.com', 'emersoncarvalho.mestrevendas@gmail.com',
  'ianllopesc@gmail.com', 'leandro.enzodon@gmail.com', 'wellingtonsouza32@hotmail.com', 'lucascoutinho.sax@gmail.com',
  'eduardosantos_777@icloud.com', 'claudinosousa1999@gmail.com', 'alenavarro.silva@gmail.com', 'denisegabril@gmail.com',
  'luis.luc@gmail.com', 'fabio.alencar@outlook.com', 'marco5cardoso@hotmail.com', 'gabrielsilvafattori@gmail.com',
  'wenemso@gmail.com', 'miguelamtopanotti@hotmail.com', 'felipealvesjosi@gmail.com', 'lucaspalmeiradesouza@gmail.com',
  'thialbdesign@gmail.com', 'as951977@gmail.com', 'alexandrewilliam2009@gmail.com', 'registrosdinho@gmail.com',
  'elodrop@protonmail.com', 'gersongameleira@gmail.com', 'tiagosaito@yahoo.com.br', 'amaurixavierjr@gmail.com',
  'rafael.henrique@elocorp.com.br', 'boka_83@hotmail.com', 'info@janvalellam.org', 'brunovitalt@gmail.com',
  'wnascimento41@yahoo.com', 'nandofpc76@gmail.com', 'fernandomarculino@gmail.com', 'lucca_vni@hotmail.com',
  'mavikaisolutions@gmail.com', 'sacramentostudioo@gmail.com', 'gabrielduarte1900@outlook.com', 'adancardoso@gmail.com',
  'michelle_morgado@yahoo.com.br', 'ranicomr@gmail.com', 'felsampaio01@gmail.com', 'adilsonbcarvalhoo@gmail.com',
  'katrielbarbosa10@gmail.com', 'victorfelixxp@gmail.com', 'thiago021alves@gmail.com', 'breno@zlk.com.br',
  'efs7308@gmail.com', 'phellipelopes21@gmail.com', 'kmipatinga@gmail.com', 'carmemdecat1@gmail.com',
  'natanleite222@gmail.com', 'contato@eljoe.com.br', 'andersonr240@gmail.com', 'brunorsrb@gmail.com',
  'teo.augusto.bsv@gmail.com', 'alexsander.anes@hotmail.com', 'apservocosinternet@gmail.com', 'notadamente73@gmail.com',
  'rodrigo.yoshioka@gmail.com', 'r.ramalhojr15@gmail.com', 'alinecruz4ever@gmail.com', 'davidgasparindavid@gmail.com',
  'douglasmatias04@gmail.com', 'leonardocampos894@gmail.com', 'julio.jr.jcbj15@gmail.com', 'maiconbtavares71@gmail.com',
  'dicaextra@yahoo.com.br', 'gilberto.justi@gmail.com', 'rachelalcantara@gmail.com', 'rogonoliver@gmail.com',
  'eduardo.m.b@hotmail.com', 'flaviopereiradesouza09@gmail.com', 'vitorferreira290707@gmail.com', 'adelson.oliveira111@gmail.com',
  'hitaloanchieta@gmail.com', 'josidesign.sa@gmail.com', 'alfredo.spinelli@gmail.com', 'guilhermegpt@hey.com',
  'bernardobatatafrita12345678910@gmail.com', 'maicondeoladasilva@gmail.com', 'erissonalves2009@gmail.com', 'matheusdamata8@hotmail.com',
  'danielwilliamsbarros@gmail.com', 'willensilvapro@gmail.com', 'moccasinivie@gmail.com', 'jpmontenegrosouza@gmail.com',
  'leonardocabo@gmail.com', 'gpauloc377@gmail.com', 'lucas.maduar@gmail.com', 'oliveiradanielweb@gmail.com',
  'dilsonlevi@gmail.com', 'arthur.gbr25@gmail.com', 'cezinio21@hotmail.com', 'jeanderson92@gmail.com',
  'nandasousa12@gmail.com', 'edubrasil1999@outlook.com', 'marcioveigamoreira@gmail.com', 'douglasnunesdecampos@gmail.com',
  'civil.franciele@gmail.com', 'gurodrigues92@gmail.com', 'alexanderbtg@gmail.com', 'claudemirhinze86@gmail.com',
  'stenio.nobres@gmail.com', 'jjjholanda@gmail.com', 'sgroiadm@gmail.com', 'rodrigodrax@gmail.com',
  'cevcastro@gmail.com', 'linassi+abrahub@proton.me', 'gabriel41628@gmail.com', 'marcelo@benez.com.br',
  'bichocarranca@gmail.com', 'dbarbosa1992@gmail.com', 'anderson.feitoza.santos@gmail.com', 'gab.biel2011@gmail.com',
  'rinaldo@neuromeddiagnosticos.com.br', 'artdaju01@gmail.com', 'bolikisabel@gmail.com', 'lanealpper@gmail.com',
  'andersongustavo692@gmail.com', 'igorgrego77@gmail.com', 'mitchel@legrandmedia.com', 'mga.vianna@hotmail.com',
  'ygorborges2@gmail.com', 'romanholi96@gmail.com', 'henrique@slacktrek.com', 'danielesolem@gmail.com',
  'e.l.motrone@gmail.com', 'cesarmichel997@gmail.com', 'lanceway777@gmail.com', 'jaapao.13@icloud.com',
  'leandro.polican@gmail.com', 'apservicosinternet@gmail.com', 'rela_marcos@hotmail.com', 'michele.miyauti@icloud.com',
  'matheus.silva3107@gmail.com', 'zvini24@gmail.com', 'sergioat2000@gmail.com', 'dsobral2020@gmail.com',
  'luccazanin@hotmail.com', 'polianoewerton@gmail.com', 'cezarleferr@gmail.com', 'alberto@ataweb.ppg.br',
  'porancelot@hotmail.com', 'fernandoalm@outlook.com', 'carluciorodrigu@gmail.com', 'felipepessoa404@gmail.com',
  'muriloviskk@gmail.com', 'alexsandrocarvalhodefreitas@gmail.com', 'jeangass@gmail.com', 'contato@inoviit.com.br',
  'cataclism22@gmail.com', 'ranieldouglas@gmail.com', 'atylasancho.b.s@gmail.com', 'h.fernandezoliveira@gmail.com',
  'raynan.artedigital@gmail.com', 'abrahubtv@gmail.com', 'vanghumusic@gmail.com', 'bibliadohomem@gmail.com',
  'ubtutorials.ublabs@gmail.com', 'pabloalexandre885@gmail.com', 'mfbarbosa28@hotmail.com', 'hugomunizbezerra@gmail.com',
  'thales@laray.com.br', 'enocksan7os@outlook.com', 'sagasfdp@gmail.com', 'phsa@me.com', 'admin@grupoflowers.com',
  'kaykgomesdeborba18@gmail.com', 'leticiacoelhoaraujo@hotmail.com', 'tenentejunior01@gmail.com', 'l.travassos@hotmail.com',
  'seres.souza@gmail.com', 'mateusholanda.business@gmail.com', 'vinibrito992@gmail.com', 'cristiansouza548@gmail.com',
  'jniltinho@gmail.com', 'felipenasctoai@gmail.com', 'io.77@outlook.com', 'sucessonolar@gmail.com',
  'mateus@redips.com.br', 'emanuelmilk25@gmail.com', 'marcio4146@gmail.com', 'lfsruel@gmail.com',
  'maykondriver@gmail.com', 'parailioojr@gmail.com', 'rennierlimabezerra@outlook.com', 'ip.ramires@uol.com.br',
  'juliofelipe345@gmail.com', 'majkds2019@gmail.com', 'yagotch1@gmail.com', 'alexvalente007@hotmail.com',
  'fernando.granato@gmail.com', 'gabrielsalomesilva@gmail.com', 'prizancanella@gmail.com', 'matheusdz@outlook.com',
  'carlinha27cc@gmail.com', 'elguiinvest@gmail.com', 'rhonaldo202@gmail.com', 'guiguirv100@gmail.com',
  'kaiquebarbosa044@gmail.com', 'amarconato6000@hotmail.com', 'amanteafelipe@gmail.com', 'gpt.henrique1@gmail.com',
  'rafaelnardellidaluz@gmail.com', 'd.zucon@hotmail.com', 'douglas.lvolt.65@gmail.com', 'gabrieldias2910@gmail.com',
  'rodrigo-goncalves2011@hotmail.com', 'controletotal02@gmail.com', 'samara.aparecid@yahoo.com.br', 'pablo.rodrigues.ht@gmail.com',
  'producaoem419@gmail.com', 'ciro@desirius.com.br', 'mirianf.negocios@gmail.com', 'guilhermevinicius28@hotmail.com',
  'vinifrvfr@gmail.com', 'vanderlei.domingos76@gmail.com'
];

async function fastImport() {
  console.log(`Iniciando importação de ${emails.length} e-mails...`);
  
  const uniqueEmails = [...new Set(emails.map(e => e.toLowerCase().trim()))];
  const records = uniqueEmails.map(email => ({ email, status: 'active' }));

  const { error } = await supabase
    .from('authorized_users')
    .upsert(records, { onConflict: 'email' });

  if (error) {
    console.error("Erro na importação:", error.message);
  } else {
    console.log("✅ Todos os e-mails foram autorizados com sucesso na whitelist!");
  }
}

fastImport();
