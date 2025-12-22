import React, { useState, useEffect, useRef } from 'react';
import { Transaction, TransactionType, Category, Account, Trip, FamilyMember, CustomCategory, Frequency, AccountType } from '../../types';
import { getCategoryIcon, parseDate } from '../../utils';
import { Calendar, ChevronDown, DollarSign, X, RefreshCcw, BellRing, Undo2, Plane, Pencil, CreditCard, User, Plus, ArrowDownLeft, ArrowUpRight, Globe, Repeat, Bell, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { BaseForm, FieldConfig, useBaseForm } from '@/components/forms/BaseForm';
import { AccountSelector } from './AccountSelector';
import { useTransactionForm } from '../../hooks/useTransactionForm';
import { Split;  );
}</div>
  >
                /}
    amentUserNrreme={cuntUserNaurre   c           s}
  Installments={setTotalentalInstallmetTot   s         
    tallments}totalInsllments={lInstaota   t         lment}
    alInstment={setIsIsInstallet   s           
  llment}taisInsnstallment={sI    i        amily}
    avigateToFFamily={onNNavigateTo        ont}
        veAmounount={acti   activeAm        
     lyMembers}famiyMembers={       famil     ts}
    pli={setSSplits set            
   plits}splits={s                Id}
PayeryerId={set     setPa         
  payerId}Id={er    pay    
        lit}dleConfirmSpnfirm={han        onCo
        mSplit}eConfirlose={handl   onC             lOpen}
itModan={isSpl      isOpe         al
 tMod  <Spli         
 </div>
            >
    </div      )}
                          n>
/Butto           <    }
         ação')mar Transires' : 'Confraçõar Alte ? 'SalvlData' : (initiaando...ting ? 'Salv  {isSubmit                         pacity`}>
 n-o transitioopacity-90} hover:buttonMainBgslate-200 ${adow- shadow-xlsht-base 2 texl h-1`w-fulassName={tting} clmiSubled={ist} disabandleSubmiick={hton onCl<But                   && (
     sReadOnly        {!i          >
   t z-20"ransparenmd:bg-t dark:nsparentd:bg-traone md:border-ntive m md:relat-0 right-0om-0 lefd bott-700 fixelaterder-sdark:bo00 slate-1er-der-t bordte-900 bork:bg-slaarite d-safe bg-wh"p-4 pbName=iv class    <d      
      >
     </div        eForm>
     </Bas           )}
                          /div>
          <                  >
         </div                            >
/div /><e-800":bg-slatte dark00 bg-whiurple-4ocus:ring-p-2 finge focus:rtline-non out-purple-300texrk:dae-900 purplxt-tepurple-800 :border-200 darkrple-er border-put-bold bord-center fonnded-xl texth-full roue="w-full assNam))} cl.valueInt(e.targets(parsestallmenttalIn setTo=>nge={e onChats || ''} nstallmen={totalI" valueOutroceholder=" plar"beum"ne=yp"><input t"relativeName=ass  <div cl                            
      n>))}num}x</butto30'} `}>{ple-900/pur:bg-:hoverple-50 dark:bg-pure-800 hoverurplr-pordee-200 dark:bpurplborder-400 purple-dark:text-urple-700 xt-p te00g-slate-8white dark:b00' : 'bg-rple-6-pu borderext-white0 t60urple- num ? 'bg-pllments ===lInstaer ${totardold boxt-sm font-bed-xl te{`py-2 roundme=sNaum)} clasments(nlInstalletTota() => sClick={on="button" penum} tyn key={ => (<butto 12].map(num0,, 5, 6, 1 {[2, 3, 4                                  >
 ls-4 gap-3"grid grid-cosName="   <div clas                             ">
e-y-3p-2 spacrom-to-in-fate-in slide800 animrple-puorder-00 dark:burple-1er border-p4 bordded-2xl p--900/20 rounrk:bg-purple dabg-purple-50lassName="v c      <di              
        Card && (ditisCreallment &&     {isInst                 )}

                           </div>
                                )}
                            iv>
/dg" /><-lne text outline-noont-bold-300 f:text-blue00 darkext-blue-9g p-2 t30 rounded-le-900/dark:bg-blu50 g-blue-center b-20 text-"w=classNameue))} alt(e.target.varseInenceDay(pecurretR{e => sge=y} onChaneDae={recurrenc"31" valu" max=]*" min="1ttern="[0-9ric" paMode="numenputnumber" ie="nput typel><iabs:</l mêdolex-1">Dia 300 ftext-blue-ue-900 dark:blt-bold text-xt-base foname="tessN><label cla /-400"text-blue600 dark:lue-6 h-6 text-bw-className="ar ><Calend-4" p0 rounded-xle-80r-blu:borde200 darkr-blue-rde border bobg-slate-900ite dark:-wh gap-4 bgcenterems-x itsName="fle <div clas                                 Y && (
  ONTHL Frequency.Mquency ===fre         {                   div>
             </                      lect>
        </se                           on>
  lmente</optiRLY}>Anuay.YEAFrequenction value={      <op                             ion>
     mente</optTHLY}>Mensalquency.MONre={Fion valuept <o                                 
      te</option>en}>SemanalmWEEKLYquency.e={Freon valu       <opti                               -400">
  -blue2 focus:ring focus:ring-nonene-bold outlifont-3 d-xl p-roundeext-sm t-blue-300 t900 dark:texlue--800 text-b-blueborder-200 dark:lueder-bborder bor-900 -slatee dark:bg-1 bg-whitsName="flexcy)} clasrequenvalue as Fget.e.tarFrequency({(e) => sete=ncy} onChangrequeue={fal   <select v                        
         lex gap-3">ssName="fcla  <div                           4">
    -y--2 spaceop-tde-in-fromn sli0 animate-iblue-80rder-00 dark:boder-blue-1 bororderxl p-5 bunded-2900/20 roue-blrk:bg-g-blue-50 da"bssName=<div cla                         (
    Recurring &&is  {                   )}

                         </div>
                        
       </div>                       
           )}                               </div>
                                        />
                                          ocked}
    ={isLdisabled                                             d"
   not-allowebled:cursor-disapointer l cursor-w-ful-none  outline-200xt-slate-700 dark:te text-slateont-boldrent fbg-transpa="  className                                           ue)}
   et.val.targe(enDatNotificatioe => setnChange={ o                                              / } }}
 gnore */* itch (e) {  cawPicker() }tTarget.shoy { e.curren { tr=>Click={(e) on                                           te}
     icationDa={notifvalue                                              date"
  e="      typ                                     input
                <                              2">
   p--xl ndeder-800 rouder-amb200 dark:borber-rder-am border boate-900dark:bg-slwhite Name="bg-class       <div                              ' && (
    stomon === 'cutierOp    {remind                         t>
       elec     </s                           >
    </optiononalizada">Data Perscustomue=" valon  <opti                               
       ion>/opta antes<={7}>1 semanption value         <o                          on>
     tes</opti2}>2 dias anion value={   <opt                          
           option>ntes</ia a1 d{1}>on value=      <opti                              
    </option>encimentodo vdia o >Nvalue={0}option     <                                 
        >                        "
       r-400us:ring-ambeing-2 focfocus:rutline-none old ol p-3 font-bounded-xm rt-s-300 text-amber00 dark:texamber-9er-800 text-der-amb dark:borr-amber-200borde border e-900g-slate dark:bfull bg-whit="w-assName      cl                               
          }}                             al);
    derOption(vetRemin          s                          ;
        lue)(e.target.vaInt : parse' ? 'custom'stom=== 'cut.value targee.nst val =     co                                      
  e={(e) => {  onChang                                    on}
  tirOpeminde    value={r                              
      select         <                          ">
 space-y-3e="sNamas     <div cl                          /div>
   <                          /span>
    r Lembrete<Configurad text-sm">t-bol="fonNamean class       <sp                           />
  5 h-5" "w-e=classNamBellRing      <                         >
      0"er-40ambrk:text-da-amber-800 -2 text2 mber gap-ent items-cme="flexdiv classNa          <                 
     3">2 space-y-om-top--in-fr-in slideanimateber-800 :border-amrk200 daorder-amber-er bl p-5 bordded-2xun0 roer-900/2dark:bg-amb50 g-amber-sName="b clas     <div                     & (
  cation &tifinableNo {e                      
 ments */}allstrring, inecuations, rific for not sectionsional* Condit     {/               v>

            </di     
              </div>                     n>}
    ></butto</spandirvid">Dibol[9px] font-Name="text-pan class><sh-4" /"w-4 e=assNamcl}><Users 0'} `te-70r:bg-sla50 dark:hover:bg-slate-hoveslate-300 0 dark:text-xt-slate-60late-700 te:border-sark-slate-200 dborderate-800 slrk:bg-te da : 'bg-whi00'xt-indigo-4k:tear-700 digoind0 text-r-indigo-80debor dark:o-200er-indig20 bordndigo-900/50 dark:bg-indigo- ? 'bg-irId !== 'me' || payeth > 0ng${splits.le-all ansitionap-0.5 tr-center gstifynter jucol items-ceflex-border flex l  rounded-xh-14me={` classNapen(true)}tModalO=> setIsSpli{() n" onClick="buttotton type=e && <buExpens      {is                        n>
  n></buttombrar</spaLe-bold"> fonttext-[9px]me="n classNa /><spa"me="w-4 h-4l classNa00'} `}><Bel-slate-7r:bgve0 dark:hor:bg-slate-500 hovete-3k:text-slaarslate-600 d00 text-te-7-slak:bordere-200 darrder-slatboe-800 latk:bg-sdar-white  'bg400' :ext-amber-r-700 dark:tambetext-0 er-80r-amb:borderk-200 damber20 border-a0/-90g-amberk:bmber-50 dar? 'bg-acation nableNotifiall ${esition--0.5 tran-center gapfy justi-centermsitex-col der flex fle bornded-xl rou{`h-14e=classNam)} tionbleNotificaation(!enaificeNot=> setEnablClick={() tton" onype="buton t    <but                          utton>}
  pan></belar</sarc">Pld font-boxt-[9px]"teassName= /><span cl4 h-4"e="w-classNamd editCar<Cr00'} `}>ate-7over:bg-slte-50 dark:hla hover:bg-sxt-slate-3000 dark:teext-slate-60ate-700 trder-sl:boate-200 darksl border-late-800rk:bg-se dag-whit' : 'ble-400:text-purpe-700 darkrpl0 text-pu80urple-k:border-p200 darpurple-border-rple-900/20 g-purk:bpurple-50 da'bg-? t nstallmenon-all ${isIransiti t0.5ap-ter gener justify-c items-cent flex-coler flexbordounded-xl ={`h-14 rlassNament)} cstallme!isInstallment(=> setIsInck={() Cliton" on"button type=ard && <butisCreditCse && pen     {isEx                       n>
    an></buttor</spld">Repetix] font-bo[9p"text-className=an " /><sp"w-4 h-4me=at classNa><Repe-700'} `}slate:hover:bg-te-50 darkover:bg-slalate-300 h:text-sate-600 dark700 text-sle-atborder-sldark:0 e-20r-slat0 bordeslate-80ark:bg-g-white d'b: blue-400'  dark:text-ue-700t-bltexr-blue-800 dark:bordelue-200 border-b0 blue-900/2k:bg--50 darue'bg-blRecurring ? on-all ${is0.5 transiticenter gap-ustify-ter j items-cenlex-colorder flex fnded-xl b-14 roulassName={`hing)} currng(!isRececurri> setIsRnClick={() =ton" oe="buttypbutton          <                       p-2">
4 gam:grid-cols-2 s grid-cols-"gridlassName=iv c <d                     >
      /label Adicionais<>Opções1"ck pl- blomb-1.5-wider se tracking00 upperca-slate-300 dark:textlate-7ext-s font-bold t[10px]me="text-bel classNa         <la          
         v>di  <                      /}
 Split * Reminder,stallment,epeat, Intions: ROp       {/*                   </div>

                   
        )}                     />
       <                        
     )}                                      </div>
                                
     ate}</p>}changeRex2">{errors.old mt--xs font-b00 text"text-red-5Name=classate && <p eRexchang    {errors.                                      
  </p>}t}tionAmounnas.desti">{error-bold mt-2xt-xs fontred-500 teame="text- classN&& <pount tionAmors.destina     {err                                    
   div>
         </                                
   /div>       <                                        </span>
                                                0'}
      '0.0tStr ||nationAmoun {desti?.currency}tAccountObjDes  {selected                                                  e">
    k text-whitacont-blxt-xl fame="tean classN      <sp                                            /span>
  ceber<Renal a ">Valor Fi400ate- text-slont-bold fe="text-xslassNaman c       <sp                                         
    ">shadow-innerte-700 border-slaborder etween justify-bcenter tems-l flex id-x0 p-4 rounde90te-g-sla"b=className      <div                                          */}
  playe DisFinal Valu {/*                                              
    </div>
                                                 </div>
                                               >
  panurrency}</scountObj?.cDestAc">{selectedt-sm-400 texslateark:text-e-500 dslatold text-="font-blassNamepan c         <s                                              />
                                                   
      }}                                                            }
                                                          ));
      ed(2)).toFixratearseFloat( * pAmountctiveountStr((aationAmetDestin      s                                                        
      e) > 0) {atrseFloat(rnt && pactiveAmou     if (a                                                    t
       ation AmounDestinlculate Auto-ca //                                                         
       eRate(rate);Exchanganual    setM                                                           e;
 get.valurate = e.tarst      con                                                       {
    ) => ange={(enCh  o                                                          te}
alExchangeRa value={manu                                                          "0.00"
 aceholder=        pl                                                    0"
e-30eholder-bluacne-none plli-lg out-300 text-bluextark:te00 dblue-7old text- font-bter text-cen-transparent"flex-1 bgssName=         cla                                               *"
    [0-9]tern=" pat                                                          
 numeric"="Modenput  i                                                       ber"
   "num    type=                                                   
     input           <                                            an>
 cy} = </sptObj?.currenlectedAccoun>1 {se"xt-smate-400 tedark:text-slate-500 d text-slont-bolame="flassN     <span c                                            
       >r-blue-800"rk:bordeue-200 da border-bldernded-xl bor roup-3g-slate-800 te dark:bwhi gap-3 bg-items-centerme="flex <div classNa                                          
             </label>                                               a
  tação do Di          Co                                              -1.5">
 mbking-wide tracppercaseslate-400 uk:text- dare-500slatext-d tnt-bolfopx] text-[10block ="lassName  <label c                                                 
 <div>                                             */}
   ate Input ge R/* Exchan    {                                   >
         "pace-y-4"sssName=cla    <div                                       
  /div>
  <                                         pan>
 nacional</são Interrse">Convepercasbold ups font-text-xame="sN <span clas                                              >
 "w-4 h-4" /className=Globe      <                                  >
         0"ext-blue-3000 dark:text-blue-83 t-2 mb-enter gap-cmsteme="flex i<div classNa                                         
   om-top-2">e-in-fr slide-in fade-inanimat4  p- rounded-xl00/30order-blue-9100 dark:br-blue-deor20 border b0/-blue-90e-50 dark:bg"bg-blussName=div cla      <                                 er && (
 rrencyTransftiCu  {isMul                            /}
      fer UI *ransrrency T Multi-cu/*   {                         
              />
                            ntId}
  ationAccoutin{setDeslect=       onSe                       
          ountId}ationAcc={destinedId select                                   unts}
    tionAccoredDestinats={filte   accoun                                 )"
    ra (Destino"Vai pa   label=                                     ector
<AccountSel                                 
         )}
                           div>
        </                                abel>
          </l                                 v>
    </di                                        }
        )?')mbionacional (Câterara Innviar pcional' : 'Eterna Innviando paraersion ? 'EisConv       : (                                                )
 l (BRL)?'para Reaer 'Convertal (BRL)' : endo para Reonvertion ? 'CConvers(is   ?                                                  l
    ationaernIntiscountObj.edAcect       {sel                                           
  " />w-3.5 h-3.5sName="<Globe clas                                                    .5">
er gap-1entlex items-came="f <div classN                                                  />
                                          "
   er-gray-30000 bordg-blue-5us:rinblue-600 focounded text-4 r4 h-Name="w-ss        cla                                     
       )}heckedn(e.target.cConversiotIs> se ={(e) onChange=                                                 version}
  sCon checked={i                                              box"
     ype="check      t                                           <input
                                              }>
          } `                                         e-700'
  :text-slate-500 hover 'text-slat          :                             
         ue-800'der-blborark:lue-200 d-bder borderd-lg bornde1.5 roupx-3 py--900/20 rk:bg-blueg-blue-50 daue-400 bxt-bl600 dark:telue-xt-b 'te  ?                                        
      ersiononv ${isColorstion-cter transi cursor-poins font-boldext-xp-2 ter gatems-centame={`flex il classN   <labe                                       -2">
  ify-end mbflex justsName="div clas       <                             (
     untObj &&ectedAcco    {sel                               ncy */}
 urreCross-Cl/nternationaggle for Iion To{/* Convers                          
                   <>                      er && (
  {isTransf                    }

        )                      iv>
              </d                  tton>
     terar</Bu-8">Als he="text-xlassNamtrue)} cOpen(sSplitModal{() => setIlick=ndary" onCnt="secoaria"sm" vton size=<But                                  div>
          </                      iv>
            </d                              >
    ta</span consai da suao ">Nã400igo-rk:text-indo-600 das text-indigxt-xme="teclassNapan         <s                                  }</span>
   || 'Outro'?.name== payerId) => m.id =rs.find(membelyM {famiPago por">-indigo-300extrk:to-900 datext-indig font-bold xt-smock tesName="bl <span clas                                  >
         <div                                  iv>
      /d5 h-5" /><sName="w-ascl"><User 00go-4inditext-dark:o-700  text-indigtify-centerjusnter x items-ce900/30 fleindigo-bg--100 dark:l bg-indigoul rounded-f-10 h10w-assName="cl    <div                                    ">
 nter gap-3s-ceflex itemssName="  <div cla                               n">
   tweeify-beustcenter jms- flex itep-4d-xl 0 roundendigo-80order-irk:bda00 er-indigo-2border bordo-900/20 g-indig50 dark:bdigo-"bg-inlassName= civ       <d                         (
  :   )                                 />
                    '}
    encontrada.onta enhuma c: 'Nional.` nacterinuma conta y}. Crie eCurrenc ${activui conta emo posscê nã ? `Vo !== 'BRL'cyurreniveCctMessage={aempty                                   
 nly} || isReadOialDataled={!!init    disab                               
 IT' : 'ALL'} 'NO_CREDsfer) ?sTran|| ime coisInrType={(       filte                            }
 AccountIdsetelect={    onS                      
          d}d={accountI selectedI                                   }
p])ectedTrirency, seluractiveCunts, ilableAcco   }, [ava                                cs;
    return ac                                      }

                               
        currency);tedTrip.== selecurrency =a => a.caccs.filter(  accs =                                        check
   double cy, but activeCurrenly dictates usualcy en Trip curr      //                             
         rip) {selectedT      if (                               ess)
   strictnthe don't relax re we suonal - engacy/Opti Filter (Lerip    // 3. T                                  

       }                                   urrency);
activeCurrency === r(a => a.cfiltecs = accs.      ac                                e {
          } els                                 BRL');
   y === ' a.currenc ||currencya => !a.filter(s.s = acc     acc                                       'BRL') {
 cy ===activeCurren if (                                    unts.
   L accow BR shog BRL, ONLY/ If handlin  /                                    
   currency.atounts of thccow aONLY sh. USD),  (e.ggn Currency ForeilingIf hand  //                                  MENT)
     UIRESER REQL Uh (CRITICAurrency Matct C/ 2. Stric  /                                    
  
counts;availableAc let accs =                               
         ss)y user acce bdy filteredlreaAccounts (ale vailablter: A1. Base Fi //                              
          () => {o(eMemact.usts={Re  accoun                               em')}
   er Recebar com' : 'se ? 'Pag: (isExpen (Origem)' 'Sai desfer ? bel={isTran  la                               ector
   countSel       <Ac                      (
    === 'me' ?   {payerId                   >
       p-3"d-cols-1 ga"grid grisName=<div clas                  
      /}n *t Selectio Accoun {/*                      
 }
      )               
   </div>                      div>
            </                        
          )}                    >
                </                        
        v>    </di                                    
    )}                                               ))
                                                    </div>
                                                      </div>
   y}</span>rrenc{t.cuunded"> ro5 py-0.5-1.00 pxslate-7k:bg- dar100late-t-bold bg-se-400 fontext-slat-500 dark:xt-slatetet-[10px] ame="tex<span className}</span>ck">{t.n blosmtext-t-bold late-200 fonk:text-sate-800 darxt-slsName="teas><span cl<div                                                            iv>
4" /></dw-4 h-ame="sNne claslaxt-xs"><Pbold te0 font-40t-violet-rk:tex-600 daletior text-vy-centeenter justiftems-cflex i/40 900iolet--vdark:bgiolet-100 bg-vll ed-fu8 roundw-8 h-ssName="iv cla      <d                                            
          ter gap-3">ms-cenflex iter-pointer 0/20 cursoviolet-90ver:bg-50 dark:hog-violet-:b="p-3 hoverame} classNalse); }n(fOpelectorsetIsTripSepId(t.id); > { setTri) =lick={(} onCv key={t.id <di                                               
        ap(t => (.m      trips                                       (
             ) :                                      
       </div>                                              </div>
                                                    
           )}                                                         button>
</                                                             agem
    Viriar  C                                                           
       h-4" />me="w-4 us classNa        <Pl                                                           >
                                                                 
rs"nsition-coloold trasm font-blg text-ounded-e r00 text-whit-violet-7 hover:bg600g-violet-y-2 bpx-4 pgap-2 s-center ex itemame="fl  classN                                                               }}
                                                                
       rips();avigateToT      onN                                                           
       en(false);ipSelectorOpetIsTr       s                                                          {
        ick={() =>       onCl                                                             ton
      <but                                                          s && (
oTripteT   {onNaviga                                                         </div>
                                                     p>
       spesas</ vincular de paragemrie uma via0">Ct-slate-40:texdarke-500 -slatext-xs textassName="tcl<p                                                               rada</p>
  cadastgem huma via">Nene-300 mb-1text-slatdark:e-700 ld text-slat font-bosmxt-e="teclassNam         <p                                                        iv>
        <d                                                
          </div>                                                  
    00" />ext-violet-4rk:tt-600 dat-violetexh-6 e="w-6 sNamPlane clas       <                                                 >
        r"tify-center jusems-cente flex itolet-900/30-vi:bglet-100 dark-vioull bgrounded-f2 2 h-1Name="w-1ss claiv   <d                                                 
        r gap-3">ms-centeflex-col itex me="flessNa <div cla                                                >
       er"text-centName="p-4   <div class                                                   0 ? (
length ===ips.tr   {                                       v>
      /dinhuma<0">Neslate-70rder-dark:bo50 te-la border-s border-bm text-smnt-mediute-300 fola-sk:textate-600 darxt-sler teursor-point00 c-slate-7hover:bg0 dark:slate-5 hover:bg-="p-3assName; }} clrOpen(false)ectoripSel); setIsTetTripId(''() => { sick={ onCl      <div                                         >
 -scrollbar"tomuso cuty-aerflow-ov-60 max-hdden ow-hi0 overfl-700 z-2-slateark:borderlate-100 dr-sordeder badow-xl bor-xl sh0 rounded:bg-slate-80ite dark-2 bg-whll mt-fu-x-0 topsolute insetsName="ab<div clas                                   >
         (false)} /enipSelectorOpsetIsTrlick={() =>  onCt-0 z-10"d insexe"fiassName=<div cl                                           
       <>                          
         (ectorOpen && {isTripSel                                  
 >div   </                               " />
  0t-slate-40 tex-5 h-5sName="wclashevronDown        <C                                 </div>
                                       an>
 nal'}</spOpcio 'rency} ` :ip?.curedTrctele: ${s ? `MoedatripId">{e blockatncdium tru font-met-slate-400texk:500 dart-slate-xt-xs tex"telassName=pan c     <s                                       }</span>
em'Viagular a uma nc'Vid)?.name :  === tripI> t.idind(t =rips.f? t`}>{tripId -300'} xt-slate600 dark:tee-: 'text-slatiolet-300' text-v dark:iolet-900t-vpId ? 'tex-0.5 ${trie mbtruncat font-bold xt-sm`block teName={n class <spa                                         idden">
  w-h overfloame="flex-1 <div classN                                       iv>
h-4" /></d4 w-assName="<Plane cl400'} `}>slate-ext-ark:t-slate-500 de-700 textdark:bg-slatslate-100 bg-' : 'xt-whitet-600 te? 'bg-violeId -0 ${tripshrinkify-center nter justce items-flexd-full h-9 roundee={`w-9 amssNv cla        <di                          }>
      700'} `rder-slate-k:boate-200 darorder-sl0 b80k:bg-slate-hite dar 'bg-wet-800' :der-violdark:boret-200 order-viollet-900/20 bark:bg-vioviolet-50 d'bg-? d r ${tripIpointeall cursor-ansition-ative trrelshadow-sm -3 apr gcente items-p-3 flexnded-xl border roue={`} classNamtorOpen)pSelecOpen(!isTriripSelector setIsTnly &&=> !isReadOonClick={() <div                            
         0' : ''}`}>ty-6-none opaci-events ? 'pointer${isReadOnly-20 elative zame={`rlassN    <div c                            >
ce-y-1"sName="spaclas    <div                  & (
       se &xpen{isE                  */}
      ly) (Expense Onn ectio Trip Sel         {/*       
                              }
  nizado */padrode ser  não po queansações trpecífico dedo es/* Conteú    {                             >
           -4"
ce-yame="spa  classN              y}
        isReadOnlsReadOnly={          i            e}
  ={falsCard       show            
     ault()}efventD e.pre(e) =>  onSubmit={                      }
ChangesicFielddleBa{hanFieldChange=    on             
       cErrors}rrors={basi       e        
         cValues}ues={basi    val              
      basicFields}   fields={                   =""
      title                  orm
      <BaseF                -4">
p-3 sm:pssName=" <div cla             dos */}
  ronizampos pad cam paraor - Usa BaseFário Basermul/* Fo          {v>

      di       </         )}
                  </div>
                 
         y}</strong>.currencselectedTripong>{ Moeda: <str                          3" />
 m:w-3 sm:h-.5 h-2.5 same="w-2lassN   <Plane c                         ">
rounded-lgpy-1  py-0.5 sm:x-3m:p-2 sblack/20 pxrk:bg-dahite/50  bg-w400text-slate-00 dark:slate-5xt-ium texs font-med] sm:text-5 text-[10pxter gap-1.items-cen-2 flex  sm:mtame="mt-1.5assN    <div cl            
        ansfer && (sTrp && !iectedTri    {sel     
           
}</p>}.amounterrorsull">{ounded-f-1 r-3 pyed-900/20 pxark:bg-r-red-50 dt-1 bgt-bold mt-xs fon00 tex-4:text-red darktext-red-600"ssName= cla&& <prs.amount ro       {er             >
</div                   >
  /                     Only}
  ed={isRead   disabl                        ly}
 Onead&& !isRata lDinitiatoFocus={!     au                      50`}
 pacity-sabled:onColor} diaite-700 ${molder-sla dark:placeh300der-slate-aceholne pl-noone outlineent border-ng-transparck bxl font-bla-43xl md:textl sm:text-xt-2x tet-center tex40px]:max-w-[2x] sm180pw-[ll max-fuw-ssName={`   cla                    
     0,00"ceholder="     pla                   e)}
    alue.target.vAmountStr(=> sete={(e)  onChang                         tr}
  {amountS     value=                       01"
p="0.       ste            
         mal"ci"de inputMode=                        r"
   ype="numbe     t                   t
    <inpu                        </span>
                
        veCurrency}cti? 'R$' : a' === 'BRLency rr{activeCu                  
          Color} `}>y-80 ${main opacit sm:mr-2-1mr font-bold -4xlextmd:t-3xl ext2xl sm:tt-exsName={`t <span clas                
        sm:px-4"> px-2llcenter w-fur justify-items-centeflex ative e="relam classNiv          <d      el>

       </lab                '}</span>
 ValorEstorno' : 'r do lound ? 'Va>{isRefe":inlin"hidden xsn className=spa <                     " />}
  3w-3 sm:h-5 sm:w-2.5 h-2.sName="asign clollarS> : <Dsm:h-3" /:w-3 .5 h-2.5 smssName="w-2<Undo2 clafund ? isRe       {             ">
    ap-1s-center gflex itemider mb-1  tracking-wuppercaseate-400 :text-slate-600 darkext-slont-bold text-[10px] f-[9px] sm:tme="textbel classNa        <la      }>
      0`0 shrink-30ation-ors duron-colransiti t{headerBg}m:py-3 $py-2 sify-center ster juntcol items-ce`flex flex-className={div          <   */}
     cíficout espeantém layoInput - M{/* Amount                )}

                /div>
       <            >
     </div                  /div>
        <                     
  </p>da.etectaicada do duplnsaçãível traoss       <p>P                      o!</p>
   ">Atençãmb-0.5ext-red-400 rk:t00 da] text-red-6r text-[10pxking-wideercase tracName="uppssp cla       <                         
="flex-1">ame classN    <div                    />
     ate-bounce"400 anim:text-red- darkext-red-600"w-5 h-5 t className=   <BellRing                  >
       ow-lg"0 shadrder-red-5000 dark:border-red-52 boborder-er gap-3 tems-cent ild flex-xs font-bo-xl texted00 p-3 roundtext-red-2 dark:text-red-800900/30 dark:bg-red-bg-red-100 ="iv className   <d                    ulse">
 e-p:pt-3 animatpx-5 pt-2 sm"px-3 sm:lassName=<div c                   && (
 eWarning  {duplicat    
            ALERT */}CATELINKING DUP* ✅ BLI   {/                 )}

         div>
            </            )}
                  /div>
                <                 ditando
/> E-3 sm:h-3" h-2.5 sm:w-2.5 ="wameil classN   <Penc                          0">
   er-amber-80dark:bord-amber-100 order border bm:gap-2ap-1.5 s gfy-centerenter justiex items-cfont-bold fls :text-x[10px] smxt--xl te sm:rounded2 rounded-lgm:p--1.5 s300 pext-amber-800 dark:text-amber-20 t-amber-900/dark:bgr-50 ambeg-ssName="bcla    <div                       ) : (
                        
  v>     </di                   /span>
    ura)<it(Leo membro outrdo por  <span>Cria                             " />
  ="w-3 h-3ssName cla <User                         
      ">-slate-700erk:bord00 dare-2order-slatrder bp-2 bor gaify-center just-centetemsd flex it-bolxs fon text-ded-lgun-2 ro400 pe-atdark:text-sl00 slate-6e-800 text-dark:bg-slatslate-100 Name="bg-iv class   <d                    (
      ReadOnly ?is          {          
    >ce-y-2"patop-2 sfrom-in slide-in-t-3 animate- pt-2 sm:ppx-53 sm:x-"pame=sNdiv clas           <         & (
 &ialData   {init            pb-32">
 scrollbar auto custom- overflow-y-"flex-1assName=v cl     <di    
   
 </div>           </div>
            tton>
    bu</ />-5 sm:h-5"-4 h-4 sm:wsName="w"><X claslion-al00 transitlate-7:bg-s0 dark:hover-10late hover:bg-s300text-slate-600 dark:ext-slate-slate-800 tdark:bg-e-50  bg-slat-700rder-slatebo200 dark:er-slate- bordnter border justify-ceertems-centlg flex i10 rounded-:w-10 sm:h-8 sme="w-8 h-ssNamnCancel} cla={oickCl  <button on                 ">
 "shrink-0ame=ssN   <div cla                </div>
    >
         utton        </b           </span>
 Transf."text-xs">e=lassNam    <span c                   
 h-3.5" />"w-3.5 sName=reshCcw clas<Ref                     `}>
   medium'} font-ate-700/50 -slk:hover:bg00/50 darte-2slaver:bg-late-400 hoark:text-sate-500 d'text-slld' : t-bofon50 -blue-900/ringk:te-200 darng-sla-1 rim ringshadow-s00 xt-blue-4-700 dark:teext-blue0/10 t-blue-50hite dark:bg'bg-wer ? nsfl ${isTration-alransid t-mrounded2 5 py-gap-1.y-center stifms-center juteex i-1 fle={`flexssNam)} cla.TRANSFERpeansactionTy(Trde setFormMo() =>ck={onClitton  <bu                   ton>
  </but              
    eita</span>xs">RecName="text-pan class    <s          
          5" />-3.-3.5 he="wht classNamUpRigow<Arr                        um'} `}>
nt-medi/50 folate-700er:bg-s dark:hovslate-200/5000 hover:bg-text-slate-4e-500 dark:'text-slat-bold' : -900/50 fontng-emerald:rie-200 darking-slat rm ring-1dow-sald-400 sha:text-emerark700 dxt-emerald-/10 teald-500erem:bg-e darkit 'bg-whcome ?n-all ${isIn transitiounded-md py-2 ro.5nter gap-1stify-cems-center ju flex ite={`flex-1 classNamee.INCOME)}sactionTypranrmMode(TFok={() => setton onClic   <but                 on>
 </butt                  /span>
 >Despesa<t-xs"e="tex classNaman    <sp            
        3.5" />w-3.5 h-Name="classft ownLeArrowD        <           
      `}>ium'}ont-med0 f0/5-70r:bg-slate:hove0 dark/5slate-200over:bg--400 hslate0 dark:text--slate-50textbold' : ' font-d-900/50rk:ring-reate-200 dag-slrinm ring-1 0 shadow-s-40:text-reddarkd-700 0 text-re-500/1ark:bg-red d ? 'bg-whitensell ${isExpeon-a transitimdd-undey-2 roap-1.5 pnter g-cestifyenter julex items-clex-1 f`fame={classNXPENSE)} actionType.Ede(TranstFormMock={() => sen onCli     <butto      >
         ap-1"ex-1 gow-inner flelative shadrounded-lg r00 p-1 bg-slate-80 dark:-slate-10bgflex assName="<div cl              -30">
  -slate-900 z dark:bgg-white.5 br gap-1items-centee-700 flex border-slat00 dark:late-1 border-sder-bhrink-0 bor1 spy- px-2 sticky top-0Name="lass  <div c
          fico */}ecím layout esp - Mantéder Tabs    {/* Hea   

     } />pRefdiv ref={to      <>
      hidden"flow-ere ov00 relativg-slate-9white dark:b bg-h-[100dvh]ax-een mx-col h-scrx fleleassName="f cliv   <d(
     rn retu

     }
          );  </div>
       
    ton>>Voltar</Butl}nCancek={oonClicondary" secant="ton vari <But        
                )}    >
      </button         
         ContaCriar                      />
  h-5" Name="w-5 s class    <Plu                     >
              
      mb-3"-colorsonitiransnt-bold tfotext-sm g ed-l-white round0 textr:bg-blue-70e-600 hove-3 bg-bluap-2 px-6 pynter gex items-ce="flme   classNa                  unts}
   ToAccoonNavigate={onClick                 
       utton   <b             & (
    nts &ouAccvigateTo      {onNa          p>
ões</ transaçgistrarre começar a a pararie uma cont mb-6">Cate-400:text-sl500 darktext-slate-"text-sm Name=class        <p       >
  rada</ponta encontma c-2">Nenhulate-300 mb-sxt:teark de-700d text-slat-bollg fontt-"texName=ssla       <p c    
        </div>             " />
lue-400ark:text-b600 d-blue- text h-8e="w-8rd classNamtCadi  <Cre          
        b-4">er mify-cent-center justflex items30 e-900/ark:bg-blu-blue-100 dbgfull nded-6 rouw-16 h-1ssName="div cla       <  ">
       centertext-p-8 ter h-full cenjustify-er items-cent-col  flexe="flexam classN        <div
      return (     {
  0) .length ===accounts    if (

 };
          } break;
                  }
            value);
  ategory(      setC          fer) {
    rans if (!isT               tegory':
e 'ca       casak;
     bre             alue);
   etDate(v     s           date':
e '         cas   break;
             alue);
   cription(vtDes  se            
  ':oncriptiesse 'd ca       {
    itch (name)       sw{
  > ) =ny: a, valuengstri= (name: nge ieldChaBasicF handlest
    concosmpos básios ca mudanças nandler para  // H  };

  
  y || ''s.categor erroregory:      cat',
  ate || 's.drror: ete da',
       n || 'criptiors.desiption: errocr       des {
 sicErrors =  const baico
  lário básros do formu Er // };

   y
   tegorca : utomático'er ? 'Ay: isTransf  categorate,
      
        dscription,     de {
   lues = basicVa  constico
  rmulário báses do fo// Valor];

    
          }] : []))
          }e }))
    abel: c.nam.name, l({ value: c> p(c =.maoriestegomCas: custoption       
         das',alizason '⭐ Per  label:              [{
ength > 0 ? ies.legorstomCatoncat(cu        ].c
          }             ]
                HER }
 tegory.OTabel: CaHER, lgory.OTte value: Ca    {                ns: [
    tio      op          
     Outros',label: '📦                 {
              },
               
             ]         
    ory.LOANS }l: CategLOANS, labeategory.e: C { valu                 S },
      EEgory.Fbel: CateES, laategory.FE: C  { value                     
 AXES },ory.TCategES, label: AX.Te: Category{ valu                       URANCE },
 ry.INSbel: CategoSURANCE, la Category.IN { value:                     ENT },
  INVESTMl: Category.NT, labeory.INVESTMElue: Categ  { va                     },
 FINANCIAL ory.ateg: CabelNCIAL, l.FINA: Category    { value                   [
  s:ption   o                 ,
 Financeiro'bel: '💰  la                          {
      },
              
          ]             ONATION }
 y.Dorbel: CategION, la.DONATue: Category      { val                 TS },
 ry.GIFegoCat: IFTS, labelegory.G value: Cat       {               
  TS },gory.PEbel: CatePETS, lategory.e: Caalu   { v                    
 E },CARSONAL_.PERgoryabel: Cate_CARE, lory.PERSONALCateg{ value:                        RSONAL },
 Category.PElabel: L, ERSONA.Pue: Category{ val                       
 : [options                    ,
soal' Pes  label: '👤         
                {        
 ,        }     ]
                  }
      OKSgory.BO Catel: labeegory.BOOKS,value: Cat  {                     },
  RSES Category.COUbel: ES, lagory.COURStelue: Cava         {               ON },
 ory.EDUCATI: CategelabCATION, legory.EDUalue: Cat     { v              s: [
         option           ,
     ção' '🎓 Educalabel:             {
                     },
                ]
                 }
      PPINGE_SHOCategory.HOM: , labelING.HOME_SHOPPe: Categoryalu    { v              },
      .BEAUTY egoryabel: Caty.BEAUTY, le: Categor     { valu        
            },CSONI.ELECTRtegorylabel: CaCS, ELECTRONIory.e: Categlu    { va            ,
        LOTHING }y.Cl: CategorOTHING, labeory.CLe: Categ  { valu                    },
  SHOPPING Category.abel: , lPPINGtegory.SHO value: Ca   {                    [
  options:           
         as', Comprbel: '🛍️         la
                  {        },
         ]
                         ES }
   ry.HOBBI: CategoelHOBBIES, labtegory.lue: Ca    { va                     },
ELgory.TRAVteL, label: CaVEgory.TRAteCa  { value:              
         REAMING }, Category.STbel:laTREAMING, gory.Sate C   { value:                   ,
  AINMENT }ENTERTl: Category. labeAINMENT,ERTtegory.ENT{ value: Ca                 
       },EISURE y.Legorabel: CatLEISURE, l: Category.    { value               s: [
      option                   r',
: '🎬 Laze    label            
        {            },
                  ]
                  M }
ry.GYategoYM, label: C: Category.G  { value                   
   },ory.EXAMS el: CategAMS, labategory.EXlue: C{ va                 
        },OROCTry.Dbel: CategoDOCTOR, laegory.: Cat  { value                 },
     .PHARMACY ryatego Cbel:PHARMACY, lary.alue: Catego v    {                TH },
    egory.HEALbel: CatLTH, laHEA: Category.   { value                   tions: [
         op            e',
 el: '🏥 Saúd      lab                {
              },
          
                ]         ING }
 tegory.PARK, label: CaRKINGategory.PAalue: C       { v        ,
         NTENANCE }E_MAICLHIry.VECatego: ANCE, labelTENHICLE_MAINry.VE: Catego     { value                ,
   ANSPORT }ry.PUBLIC_TRatego: CORT, label_TRANSPICategory.PUBL{ value: C                       FUEL },
 : Category.FUEL, labelgory.atevalue: C   {                      },
 y.UBERel: Categorab.UBER, lategoryue: C{ val                       ,
 TATION }.TRANSPORegoryel: Cat, labTIONSPORTATRANe: Category.      { valu             
      options: [                 e',
  sportran'🚗 Tlabel:             {
                       
        },               ]
             }
 NACKS ategory.S: CCKS, labelry.SNA Categoalue: v          {            },
  y.GROCERY tegorel: Caaby.GROCERY, llue: Categor       { va                ANTS },
 ry.RESTAURgoateS, label: CRESTAURANTry.egovalue: Cat {                 ,
       OOD }ry.Fego label: Category.FOOD,e: Cat{ valu                      s: [
   option             ão',
      Alimentaçabel: '🍽️           l       
             {},
                
           ]               ES }
.UTILITIegory, label: CatUTILITIES: Category. value   {                   E },
  FURNITURCategory.: TURE, labelFURNIry.tego: Caalue v     {                   },
 CEINTENANtegory.MAabel: CaINTENANCE, l Category.MA value:     {             },
      y.RENT el: CategorNT, labry.REategoe: Clu va          {         G },
     ory.HOUSINCateg label: y.HOUSING,gor value: Cate      {                ions: [
    opt              dia',
    : '🏠 Morabel   la              
             {: [
       ]                }
                 ]
       
        OTHER }ategory.ER, label: Cegory.OTHe: Cat  { valu                 
     ,EIVED }ory.GIFT_RECl: CategabeIVED, lCEGIFT_REory.Categ value:       {             },
      egory.REFUNDel: CatFUND, labgory.RE value: Cate      {              
    tions: [   op                 s',
tro'↩️ Ou    label:           
        {        
        },                ]
                T }
  INVESTMENategory. Cel: labENT,VESTMCategory.INlue:  va       {       
          VIDENDS },ory.DIabel: Categ, lIVIDENDS Category.D   { value:                     ptions: [
         o           dimentos',
: '📈 Renlabel                        {
 
            },              ]
                LES }
     ategory.SA Cl:ALES, labeategory.Sue: C { val                  
     SINESS },.BUtegory, label: Ca.BUSINESS: Category  { value                      LANCE },
ory.FREEegatbel: C, la.FREELANCEtegorye: Ca { valu                       .INCOME },
: Category labelory.INCOME,e: Categ     { valu             
       [  options:                tradas',
  '💰 En    label:               
         {    ? [
     isIncome ndefined : ( uansfer ?isTroups: gr       
     undefined,:          )  </div>
               pan>
   ico</s">Automát400text-slate-s font-bold ext-xssName="t<span cla               
     -700">teslaark:border--200 dder-slater borr bordefy-centeenter justitems-c i h-10 flexnded-xle-800 roudark:bg-slatlate-50 me="bg-s classNa<div                ) => (
r ? (sTransfe render: i          ReadOnly,
 abled: is    dis,
         : 'select'm'stofer ? 'cupe: isTrans     ty  
     a',goriate: 'C  label     
     ,y'gorme: 'cate         na  {
                 },
ReadOnly
d: isisable    d     true,
      required:    
      e: 'date',        typ     'Data',
 label:     e',
        name: 'dat  {
           },
             Only
d: isReadble  disa    e,
      ed: truir     requ       ',
 Salárioço, Uber, 'Ex: Almoder:    placehol    xt',
     'te     type:  ção',
     : 'Descri      labelon',
       'descripti       name:    {
     ] = [
    onfig[elds: FieldCicFinst basForm
    coando Basebásicos usos mp dos caiguraçãoConf

    // Id]);ationAccountestinunts, dcotinationAcedDeslter   }, [fi }
       ('');
 ccountIdDestinationAset) ists    if (!ex     
   );ionAccountIdtinat=== des=> a.id unts.find(a ionAccotinatDesilteredsts = f  const exi          > 0) {
.length countsinationAcedDestfilterd && onAccountI(destinati    if {
    fect(() => useEf   ed out
 nt if filtercou dest acset/ Re /   

ersion]);onvisCransfer, , isTAccountObj, selecteduntIdacco [accounts,     },       });
   }
 
              }          'BRL';
 urrency === && acc.cational ntern.isIcc  return !a               ts
   accoun-> Show BRL  BRL to BRL sending fromr:   // Transfe               {
      } else       
       !== 'BRL';currency onal || acc.rnatiisIntern acc.  retu          
        al accountsionInternat Show  to USD ->rom BRL fbio: sending // Câm                {
   onversion) sC (i  if            is BRL
      // Sender            
  else {        }    }
             ;
   == 'BRL' !rency| acc.curernational |.isIntcceturn a           r      y)
    currencforeign OR t (flaggedonal accountinanterlow ANY I Al       //            accounts
 rnational te-> Show Inr Int) heoto USD (or rom USD tending fr: sferans  // T               {
    se el  }          
    BRL';ncy === '&& acc.currernational te.isInturn !acc     re              ounts
 BRL accow BRL -> Shto rom USD ending f/ Câmbio: s         /   {
        version)  if (isCon        
       Currency)n oreigr Fational (ois Intern Sender   //        
      rnational) {eInteourcf (isS  i
          ';
 !== 'BRL.currencyedAccountObj| selectal |nternationtObj.isItedAccounselecnal = natioeInterurct isSo      consc
      on Logiersi // Conv    

       se; falRD') return_CAREDIT === 'C string)pe asty|| (acc.CREDIT_CARD ountType.pe === Accacc.ty (          if   card
 creditransfer TOVER t    // NE        false;
tId) return == accound =cc.iif (a        f
     itsel toansfer// Cannot tr         => {
   acc nts.filter(ourn acc       retu

  [];tObj) returnectedAccounfer || !selns  if (!isTra {
      mo(() =>eMeeact.usccounts = RestinationA filteredDonst);

    ctId], [accounse);
    }alion(fetIsConvers        s
ect(() => {  useEffes
  unt changif accogle ersion toget convRes// 
    se);
alate(f React.useSt] =Conversion setIssConversion, const [ir Logic
   sfeTran Strict    // NEW:);

 ectedTrip]ts, selounlableAccavai
    }, [rrency);ip.cu selectedTrcurrency ===c => acc.(acfilters.ccountilableA avarn   returency
     trip's curch the at mat accounts th// Only show        }
   able
     counts availip = all actr No  //Accounts;leavailaburn  ret       {
     ectedTrip)el!s       if () => {
 Memo(( = React.useorTripountsFfilteredAccnst cy
    co currenME SAts with theaccounn ONLY use ses caip expenATCH: TrNCY MRICT CURRE// ST
    ipId);
t.id === tr.find(t => rip = tripsedTconst select
    onId;
tiransacrceTa?.souatlDtia!inicked = !st isLo    con
AD ONLY., IT IS REansactionId)sourceTr (has Mirroron is a s transactiGIC: If thiLOLOCK 
    // ;
g-blue-700'0 hover:b-blue-6000' : 'bgd-7-emeralver:bgerald-600 home ? 'bg-emnco-700' : isI-redhover:bg0 g-red-60 ? 'b : isExpense-amber-700'r:bghove0 60g-amber-efund ? 'b isRg =buttonMainB
    const /30';50rk:bg-blue-9blue-50 da 'bg-50/30' :erald-9k:bg-emrald-50 dar? 'bg-emecome 0/30' : isIn:bg-red-95-50 dark ? 'bg-redsExpense : ir-950/30'g-ambe:b50 darkr-d ? 'bg-ambeisRefunBg = header
    const ue-400';xt-bl600 dark:te'text-blue- : 00'erald-4text-emdark:d-600 meral 'text-ee ? : isIncom-400'xt-redark:te-600 d ? 'text-redsExpense-400' : iberxt-amdark:ter-600 xt-ambe ? 'teRefund = isinColor const ma
   category);oryIcon(tCategoryIcon = gest Categ
    con
ormMode]); [f},;
     'smooth' }) behavior:ew({crollIntoVi?.sRef.current  top
      > {t(() =Effec   use  });

 e
   onSav,
             trips,
  ionsnsacttra,
        accounts,
        odemM     for,
   itialData       inorm({
 sactionFeTran us
    } =tingSubmit    is
    Warning,uplicate     dubmit,
   ndleS       ha,
 litConfirmSp  handle  fer,
     isTrans       ncome,
     isIense,
   Exp is   ,
    sCreditCard  ibj,
      stAccountO selectedDej,
       dAccountOb selecte
       nsfer,rencyTraisMultiCurs,
        lableAccountvai  acy,
      activeCurren,
        veAmountcti,
        aors        errisRefund,

        rOption, setReminderOption,  reminde
      ate,ificationDte, setNoticationDaif     notion,
   bleNotificatsetEnaon, eNotificati enabl
       allments,Instal setTotallments,talInst  to   ,
   lmentrentInstalnt, setCurllmeentInstacurr   nt,
     mesInstallment, setIstall isIn    Day,
   Recurrencey, setnceDa     recurre  y,
 requenctFency, serequ  f    rring,
  setIsRecusRecurring, 
        itPayerId,Id, se      payer
  lOpen,ModaplittIsSlOpen, seitModasSpl  i
      lits,plits, setSp
        sctorOpen,tIsTripSele, setorOpenisTripSelec       
 d,setTripId,   tripI      
untId,inationAccosetDest, nAccountIdestinatio  d,
      countIdetAcaccountId, s       
 etCategory,gory, s      catee,
   setDatte,     da
   n,tiosetDescripn, tioipescr    date,
    ualExchangeRate, setManExchangeRanual        mtStr,
ountionAmsetDestina, nAmountStrestinatio,
        dmountStrtStr, setA    amounst {
    

    conisOwner;adOnly = !Rest iscon;
    urrentUserId === crIdusenitialData.erId || ientUsd || !currData.userIal| !initiialData |nitr = !ionst isOwne c
   CHECKSHIP // OWNERll);

    nuent>(HTMLDivElem= useRef<onst topRef  {
    c
}) =>IdrentUser,
    curameurrentUserN   c
 oFamily,vigateTs,
    onNaripgateToT  onNaviccounts,
  ToANavigate on
    onCancel,ve,
      onSas,
 ietegorustomCa[],
    clyMembers = ],
    fami = [    trips],
= [ctions ransa tunts,
    acco  FormMode,
 set   Mode,
 rmta,
    foDa  initial
  rops> = ({ctionFormP<Transa.FCmNew: ReactsactionFornst Tranport co/
exticos
 *isual idênnto v comportamerva layout e * Preseários
ormulcódigo de fão de licaçduz dup
 * Reria), categocrição, datazados (desonios padrcamprm para * Usa BaseFonsações
 fica de traade especíuncionalidm toda f* Mantéorm
 usando BaseFefatorado actionForm r
 * Trans}

/**ing;
strrId?: se    currentUstring;
Name?: ercurrentUs void;
     () =>amily?:igateToF
    onNav=> void;oTrips?: () igateT
    onNav) => void;s?: (ountccgateToA  onNavi> void;
  el: () =Canc    on => void;
n)e: booleaeFutur updatt: boolean, isEdiansaction,types').Tr./../ort('.: (data: imp
    onSaveategory[];ustomC: CoriesustomCateg
    cer[];lyMemb FamiyMembers:amil
    f;: Trip[]   trips;
 nsaction[]Transactions?:     traount[];
ts: Acc   accoun => void;
 e | null)sactionTypTran: ode: (modeetFormM   sonType;
 TransactiormMode: l;
    faction | nulta?: TransnitialDa   ips {
 onFormProransactiterface Tdal';

inlitMoom './SpModal } fr