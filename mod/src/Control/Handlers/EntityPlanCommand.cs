using System.Threading;
using System.Threading.Tasks;
using ArdenfallCompendium.Extraction;
using HotRepl.Control;
using Newtonsoft.Json.Linq;

namespace ArdenfallCompendium.Control.Handlers;

public sealed class EntityPlanCommand : IControlCommandHandler
{
    private const int BatchSize = 100;
    private readonly CompendiumRunManager _runs;
    private readonly IItemExtractionCache _items;

    public EntityPlanCommand(CompendiumRunManager runs, IItemExtractionCache items)
    {
        _runs = runs;
        _items = items;
    }


    public ControlCommandDescriptor Descriptor { get; } = new(
        "entity.plan",
        1,
        ControlCommandKind.Synchronous,
        mutatesState: false,
        argsSchema: CompendiumCommandSchemas.AnyObject,
        resultSchema: CompendiumCommandSchemas.AnyObject);

    public ValueTask<ControlCommandResult> ExecuteAsync(ControlCommandContext context, JObject args, CancellationToken cancellationToken)
    {
        var entity = args["entity"]?.Value<string>();
        if (entity != "item")
            return new ValueTask<ControlCommandResult>(CompendiumCommandResults.Validation("unsupportedEntity", "Only entity 'item' is supported."));

        var runId = args["runId"]?.Value<string>();
        if (string.IsNullOrWhiteSpace(runId))
            return new ValueTask<ControlCommandResult>(CompendiumCommandResults.Validation("runIdRequired", "runId is required."));
        if (!_runs.TryGet(runId, out var run))
            return new ValueTask<ControlCommandResult>(CompendiumCommandResults.Validation("unknownRun", $"Unknown run '{runId}'."));

        var total = _items.GetOrExtract(run).Count;
        var plan = run.SetEntityPlan("item", total, BatchSize);
        _runs.Save(run);
        return new ValueTask<ControlCommandResult>(CompendiumCommandResults.Ok(new JObject
        {
            ["entity"] = plan.Entity,
            ["total"] = plan.Total,
            ["batchSize"] = plan.BatchSize,
            ["batches"] = plan.Total == 0 ? 0 : (plan.Total + plan.BatchSize - 1) / plan.BatchSize,
        }));
    }
}
